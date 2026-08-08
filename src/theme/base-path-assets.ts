import { toAppPath } from '../app/appLocation';

function normalizeAssetElement(element: Element) {
  if (!(element instanceof HTMLImageElement)) return;
  const source = element.getAttribute('src');
  if (!source?.startsWith('/assets/')) return;
  element.setAttribute('src', toAppPath(source));
}

function normalizePublicAssetPaths(root: ParentNode = document) {
  if (root instanceof Element) normalizeAssetElement(root);
  root.querySelectorAll?.('img[src^="/assets/"]').forEach(normalizeAssetElement);
}

normalizePublicAssetPaths();

const observer = new MutationObserver((records) => {
  for (const record of records) {
    record.addedNodes.forEach((node) => {
      if (node instanceof Element) normalizePublicAssetPaths(node);
    });
  }
});

observer.observe(document.documentElement, { childList: true, subtree: true });
