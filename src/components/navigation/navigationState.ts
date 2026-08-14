export function isWorkPath(pathname: string) {
  return pathname === '/work' || pathname.startsWith('/work/');
}

/**
 * Visual navigation context can be broader than the exact link target. For
 * example, mobile Work screens live under the Home section because Work is not
 * a mobile primary-nav item. This helper is only for the highlighted style.
 */
export function isNavSectionActive(itemPath: string, pathname: string, desktop: boolean) {
  if (itemPath === '/work') return isWorkPath(pathname);
  if (itemPath === '/') {
    return pathname === '/'
      || pathname === '/tasks'
      || pathname.startsWith('/life/')
      || (!desktop && isWorkPath(pathname))
      || pathname === '/money'
      || pathname === '/health'
      || pathname === '/reflection'
      || pathname === '/check-ins'
      || pathname === '/notifications';
  }
  return pathname === itemPath;
}

/**
 * aria-current="page" is intentionally exact. A parent/section link may stay
 * visually highlighted while a descendant screen is open, but it must not
 * claim to be the current page when its href points somewhere else.
 */
export function isNavCurrentPage(itemPath: string, pathname: string) {
  return pathname === itemPath;
}
