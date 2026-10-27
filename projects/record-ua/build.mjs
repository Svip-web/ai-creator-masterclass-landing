import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { lstat, mkdir, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';

const project = dirname(fileURLToPath(import.meta.url));
const source = resolve(project, 'src');
const destination = resolve(project, 'dist');
const require = createRequire(import.meta.url);
let esbuild;
try { esbuild = require('esbuild'); }
catch {
  try { esbuild = require(resolve(project, '../ai-creator-site/node_modules/esbuild')); }
  catch { throw new Error('esbuild 0.27.3 is required to build. Install the project devDependencies, then run npm run build.'); }
}

const required = [
  'index.html', 'config.js', 'js/app.js', 'js/crm.mjs', 'js/tracking.js',
  'styles.css', 'css/local.css', 'css/fonts.css',
  'vendor/intlTelInput.min.js', 'vendor/utils.js', 'vendor/intlTelInput.min.css',
  'images/flags.png', 'images/flags@2x.png',
  'images/video-poster-480.webp', 'images/video-poster-960.webp', 'images/video-poster-1440.webp',
  '.htaccess', '_headers'
];
// Read and compile everything before replacing the currently usable dist folder.
const inputs = new Map(await Promise.all(required.map(async path => [path, await readFile(resolve(source, path))])));
const fontNames = (await readdir(resolve(source, 'fonts'))).filter(name => name.endsWith('.woff2')).sort();
if (!fontNames.length) throw new Error('src/fonts has no WOFF2 fonts. Existing dist was not changed.');
const fonts = await Promise.all(fontNames.map(async name => [name, await readFile(resolve(source, 'fonts', name))]));
const outputs = new Map();
const entries = {};
const textInput = path => inputs.get(path).toString('utf8');
const digest = bytes => createHash('sha256').update(bytes).digest('hex').slice(0, 12);

function addHashed(folder, name, bytes) {
  bytes = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  const extension = extname(name), stem = basename(name, extension);
  const path = `${folder}/${stem}.${digest(bytes)}${extension}`;
  outputs.set(path, bytes);
  return path;
}

for (const [name, bytes] of fonts) outputs.set(`fonts/${name}`, bytes);
for (const name of ['flags.png', 'flags@2x.png', 'video-poster-480.webp', 'video-poster-960.webp', 'video-poster-1440.webp']) {
  let outputName = name, bytes = inputs.get(`images/${name}`);
  if (name.endsWith('.png')) {
    try { outputName = name.replace(/\.png$/, '.webp'); bytes = await readFile(resolve(source, 'images', outputName)); }
    catch (error) { if (error.code !== 'ENOENT') throw error; outputName = name; }
  }
  const path = addHashed('images', outputName, bytes);
  entries[name === 'flags.png' ? 'flags' : name === 'flags@2x.png' ? 'flags2x' : `poster${name.match(/\d+/)[0]}`] = path;
}

const transformOptions = { minify: true, charset: 'utf8', legalComments: 'none', target: 'es2020', sourcemap: false };
// Transform, not bundle: the vendor files intentionally publish globals on window.
entries.phoneScript = addHashed('assets', 'phone-core.js', (await esbuild.transform(textInput('vendor/intlTelInput.min.js'), { ...transformOptions, loader: 'js' })).code);
entries.phoneUtils = addHashed('assets', 'phone-utils.js', (await esbuild.transform(textInput('vendor/utils.js'), { ...transformOptions, loader: 'js' })).code);
let phoneCss = textInput('vendor/intlTelInput.min.css').replace(/url\(\s*(['"]?)([^'"\)]+)\1\s*\)/g, (match, _quote, value) => {
  const name = basename(decodeURIComponent(value.trim()).replaceAll('\\', '/'));
  if (name === 'flags.png') return `url("../${entries.flags}")`;
  if (name === 'flags@2x.png') return `url("../${entries.flags2x}")`;
  return match;
});
entries.phoneStyle = addHashed('assets', 'phone.css', (await esbuild.transform(phoneCss, { ...transformOptions, loader: 'css' })).code);
const siteCss = ['css/fonts.css', 'styles.css', 'css/local.css'].map(textInput).join('\n');
entries.css = addHashed('assets', 'site.css', (await esbuild.transform(siteCss, { ...transformOptions, loader: 'css' })).code);
entries.tracking = addHashed('assets', 'tracking.js', (await esbuild.transform(textInput('js/tracking.js'), { ...transformOptions, loader: 'js' })).code);
const app = await esbuild.build({
  entryPoints: [resolve(source, 'js/app.js')], absWorkingDir: project,
  outfile: 'app.js', bundle: true, write: false, platform: 'browser', format: 'esm', ...transformOptions,
  define: {
    PHONE_STYLE_URL: JSON.stringify(`./${entries.phoneStyle}`),
    PHONE_SCRIPT_URL: JSON.stringify(`./${entries.phoneScript}`),
    PHONE_UTILS_URL: JSON.stringify(`./${entries.phoneUtils}`)
  },
  logLevel: 'silent'
});
if (app.outputFiles.length !== 1) throw new Error('Expected one application JS bundle. Existing dist was not changed.');
entries.app = addHashed('assets', 'app.js', Buffer.from(app.outputFiles[0].contents));

const faces = textInput('css/fonts.css').match(/@font-face\s*\{[^}]*\}/g) || [];
function fontFor(range) {
  const face = faces.find(text => range.test(text));
  const url = face?.match(/url\(\s*['"]?([^'"\)\s]+)/)?.[1];
  if (!url) throw new Error(`Required preload font not found (${range}). Existing dist was not changed.`);
  const path = `fonts/${basename(url)}`;
  if (!outputs.has(path)) throw new Error(`Missing preload font ${path}. Existing dist was not changed.`);
  return path;
}
entries.fontLatin = fontFor(/U\+0000-00FF/i);
entries.fontCyrillic = fontFor(/U\+0400-045F/i);
const replacements = {
  CSS_URL: entries.css, APP_URL: entries.app, TRACKING_URL: entries.tracking,
  POSTER_480: entries.poster480, POSTER_960: entries.poster960, POSTER_1440: entries.poster1440,
  FONT_LATIN: entries.fontLatin, FONT_CYRILLIC: entries.fontCyrillic
};
let html = textInput('index.html');
for (const [token, path] of Object.entries(replacements)) html = html.replaceAll(`{{${token}}}`, `./${path}`);
if (/\{\{[A-Z0-9_]+\}\}/.test(html)) throw new Error('Unresolved HTML template token. Existing dist was not changed.');
// Preserve inline whitespace: headings have intentional spaces around <em>.
html = html.replace(/<!--[\s\S]*?-->/g, '').split(/\r?\n/).map(line => line.trim()).filter(Boolean).join('\n') + '\n';
outputs.set('index.html', Buffer.from(html));
const config = textInput('config.js').replaceAll('__POSTER_URL__', `./${entries.poster1440}`);
await esbuild.transform(config, { loader: 'js', logLevel: 'silent' });
outputs.set('config.js', Buffer.from(config));
outputs.set('.htaccess', inputs.get('.htaccess'));
outputs.set('_headers', inputs.get('_headers'));

for (const [path, content] of outputs) {
  if (!path.endsWith('.css')) continue;
  for (const match of content.toString().matchAll(/url\(\s*(['"]?)([^'"\)]+)\1\s*\)/g)) {
    const url = match[2].trim();
    if (/^(?:data:|https?:|#|\/)/i.test(url)) continue;
    const local = relative(destination, resolve(destination, dirname(path), decodeURIComponent(url))).split(sep).join('/');
    if (!outputs.has(local)) throw new Error(`CSS ${path} refers to absent output ${local}. Existing dist was not changed.`);
  }
}

// Validate the resolved target before the only recursive removal in this build.
const actualProject = await realpath(project);
if (relative(actualProject, destination) !== 'dist' || basename(destination) !== 'dist') throw new Error('Unsafe build destination.');
try {
  const info = await lstat(destination);
  if (info.isSymbolicLink() || relative(actualProject, await realpath(destination)) !== 'dist') throw new Error('Refusing to replace a redirected dist folder.');
} catch (error) { if (error.code !== 'ENOENT') throw error; }
await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
for (const [path, content] of outputs) {
  const file = resolve(destination, path);
  if (!file.startsWith(destination + sep)) throw new Error('Unsafe output path.');
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, content);
}

const textExtensions = new Set(['.html', '.css', '.js', '.mjs', '.json', '.svg']);
const outputFiles = [...outputs].map(([path, content]) => ({
  path, rawBytes: content.length, gzipBytes: gzipSync(content, { level: 9 }).length,
  brotliBytes: brotliCompressSync(content, { params: { [constants.BROTLI_PARAM_QUALITY]: 6 } }).length,
  compressedAtRuntime: textExtensions.has(extname(path)) && content.length > 512
})).sort((a, b) => a.path.localeCompare(b.path));
let before = [];
try { before = JSON.parse(await readFile(resolve(project, 'optimization/before-manifest.json'), 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
const beforeFiles = before.map(file => ({ path: file.Path.replaceAll('\\', '/'), rawBytes: file.Bytes }));
const sum = files => files.reduce((total, file) => total + file.rawBytes, 0);
const beforeJs = sum(beforeFiles.filter(file => /\.(?:m?js)$/.test(file.path)));
const initialPaths = ['index.html', 'config.js', entries.css, entries.app, entries.tracking, entries.fontLatin, entries.fontCyrillic];
const initialFiles = outputFiles.filter(file => initialPaths.includes(file.path));
const initialJs = sum(initialFiles.filter(file => /\.js$/.test(file.path)));
const manifest = {
  esbuildVersion: esbuild.version, entries, files: outputFiles,
  totals: {
    files: outputFiles.length, rawBytes: sum(outputFiles),
    gzipTransferBytes: outputFiles.reduce((total, file) => total + (file.compressedAtRuntime ? Math.min(file.rawBytes, file.gzipBytes) : file.rawBytes), 0),
    brotliTransferBytes: outputFiles.reduce((total, file) => total + (file.compressedAtRuntime ? Math.min(file.rawBytes, file.brotliBytes) : file.rawBytes), 0)
  },
  initialPage: {
    paths: initialPaths, rawBytesWithoutResponsivePoster: sum(initialFiles), javaScriptRawBytes: initialJs,
    excludedUntilInteraction: [entries.phoneStyle, entries.phoneScript, entries.phoneUtils, entries.flags, entries.flags2x, 'Bunny iframe/player/video stream'],
    note: 'Responsive poster transfer is one viewport-dependent image. Byte savings are not a measured load-time percentage.'
  },
  comparison: beforeFiles.length ? {
    before: { files: beforeFiles.length, totalRawBytes: sum(beforeFiles), initialJavaScriptRawBytes: beforeJs },
    after: { totalRawBytes: sum(outputFiles), initialJavaScriptRawBytes: initialJs },
    initialJavaScriptSavedBytes: beforeJs - initialJs,
    initialJavaScriptReductionPercent: Number(((beforeJs - initialJs) / beforeJs * 100).toFixed(2)),
    totalRawSavedBytes: sum(beforeFiles) - sum(outputFiles)
  } : null
};
await mkdir(resolve(project, 'optimization'), { recursive: true });
await writeFile(resolve(project, 'optimization/build-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ files: manifest.totals.files, rawBytes: manifest.totals.rawBytes, initialJavaScriptRawBytes: initialJs, initialJavaScriptReductionPercent: manifest.comparison?.initialJavaScriptReductionPercent }));
