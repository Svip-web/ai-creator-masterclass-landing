// Один мережевий запит на ресурс; невдале завантаження можна повторити.
export function createAssetLoader(documentRef) {
  const pending = new Map();
  return function loadAsset(url, kind = 'script') {
    if (pending.has(url)) return pending.get(url);
    let resolvePromise, rejectPromise, node, timeout;
    let settled = false;
    const promise = new Promise((resolve, reject) => { resolvePromise = resolve; rejectPromise = reject; });
    pending.set(url, promise);
    function finish(failed = false) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (node) { node.onload = null; node.onerror = null; }
      if (failed) {
        node?.remove();
        if (pending.get(url) === promise) pending.delete(url);
        rejectPromise(new Error('Не вдалося завантажити поле телефону. Перевірте з’єднання та спробуйте ще раз.'));
      } else resolvePromise();
    }
    try {
      node = documentRef.createElement(kind === 'style' ? 'link' : 'script');
      node.onload = () => finish();
      node.onerror = () => finish(true);
      if (kind === 'style') { node.rel = 'stylesheet'; node.href = url; }
      else { node.src = url; node.async = true; }
      timeout = setTimeout(() => finish(true), 20000);
      documentRef.head.appendChild(node);
    } catch { finish(true); }
    return promise;
  };
}
