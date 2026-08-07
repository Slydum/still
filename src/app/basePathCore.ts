export function normalizeBaseUrl(baseUrl: string) {
  const normalized = baseUrl || '/';
  return normalized.endsWith('/') ? normalized : `${normalized}/`;
}

export function basePathFromUrl(baseUrl: string) {
  const normalized = normalizeBaseUrl(baseUrl);
  return normalized === '/' ? '' : normalized.replace(/\/$/, '');
}

export function normalizeRoutePath(path: string) {
  if (!path || path === '/') return '/';
  return path.startsWith('/') ? path : `/${path}`;
}

export function buildAppPath(baseUrl: string, path = '/') {
  const basePath = basePathFromUrl(baseUrl);
  const routePath = normalizeRoutePath(path);
  if (!basePath) return routePath;
  return routePath === '/' ? `${basePath}/` : `${basePath}${routePath}`;
}

export function stripAppBasePath(baseUrl: string, pathname: string) {
  const basePath = basePathFromUrl(baseUrl);
  if (!basePath) return pathname || '/';
  if (pathname === basePath || pathname === `${basePath}/`) return '/';
  if (pathname.startsWith(`${basePath}/`)) return pathname.slice(basePath.length) || '/';
  return pathname || '/';
}
