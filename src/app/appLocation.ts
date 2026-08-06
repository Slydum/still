const normalizedBaseUrl = import.meta.env.BASE_URL.endsWith('/')
  ? import.meta.env.BASE_URL
  : `${import.meta.env.BASE_URL}/`;

const basePath = normalizedBaseUrl === '/'
  ? ''
  : normalizedBaseUrl.replace(/\/$/, '');

function normalizeRoutePath(path: string) {
  if (!path || path === '/') return '/';
  return path.startsWith('/') ? path : `/${path}`;
}

export const APP_BASENAME = basePath || '/';

export function toAppPath(path = '/') {
  const routePath = normalizeRoutePath(path);
  if (!basePath) return routePath;
  return routePath === '/' ? `${basePath}/` : `${basePath}${routePath}`;
}

export function getAppRoutePathname(pathname = window.location.pathname) {
  if (!basePath) return pathname || '/';
  if (pathname === basePath || pathname === `${basePath}/`) return '/';
  if (pathname.startsWith(`${basePath}/`)) {
    return pathname.slice(basePath.length) || '/';
  }
  return pathname || '/';
}

export function toAppUrl(path = '/') {
  return new URL(toAppPath(path), window.location.origin).toString();
}
