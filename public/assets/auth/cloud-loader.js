(() => {
  const hiddenUntilReady = document.createElement('style');
  hiddenUntilReady.textContent = '.auth-mascot:not([data-cloud-ready="true"]){visibility:hidden!important}';
  document.head.appendChild(hiddenUntilReady);

  const loaderScript = document.currentScript;
  const assetRoot = loaderScript instanceof HTMLScriptElement
    ? new URL('./', loaderScript.src)
    : new URL('./assets/auth/', window.location.origin);

  const cloudSource = Promise.all(
    [1, 2, 3, 4].map((part) =>
      fetch(new URL(`cloud.part${part}.txt`, assetRoot), { cache: 'force-cache' }).then((response) => {
        if (!response.ok) throw new Error(`Cloud asset part ${part} failed to load`);
        return response.text();
      }),
    ),
  ).then((parts) => `data:image/webp;base64,${parts.join('')}`);

  const applyCloud = async () => {
    const image = document.querySelector('img.auth-mascot');
    if (!image || image.dataset.cloudReady === 'true' || image.dataset.cloudLoading === 'true') return;

    image.dataset.cloudLoading = 'true';

    try {
      const source = await cloudSource;
      const preload = new Image();
      preload.onload = () => {
        image.src = source;
        image.dataset.cloudReady = 'true';
        delete image.dataset.cloudLoading;
      };
      preload.onerror = () => {
        delete image.dataset.cloudLoading;
      };
      preload.src = source;
    } catch {
      delete image.dataset.cloudLoading;
    }
  };

  const observer = new MutationObserver(applyCloud);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  applyCloud();
})();
