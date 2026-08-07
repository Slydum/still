import { basePathFromUrl, buildAppPath, stripAppBasePath } from './basePathCore';

const baseUrl = import.meta.env.BASE_URL;
const basePath = basePathFromUrl(baseUrl);

export const APP_BASENAME = basePath || '/';

export function toAppPath(path = '/') {
  return buildAppPath(baseUrl, path);
}

export function getAppRoutePathname(pathname = window.location.pathname) {
  return stripAppBasePath(baseUrl, pathname);
}

export function toAppUrl(path = '/') {
  return new URL(toAppPath(path), window.location.origin).toString();
}
