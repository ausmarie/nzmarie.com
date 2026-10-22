export function canonicalizeReportUrl(
  pathname: string,
  idToSlug: Record<string, string>,
  slugMap: Record<string, string>,
  replaceState: (url: string) => void = (url) => {
    window.history.replaceState(window.history.state, '', url);
  }
): boolean {
  const match = pathname.match(/^\/admin\/reports\/(.+)$/);
  if (!match) return false;

  const id = match[1];
  if (!/^[a-f0-9-]{36}$/.test(id)) return false;

  const targetSlug = idToSlug[id];
  if (!targetSlug || slugMap[targetSlug] !== id) return false;

  replaceState(`/admin/reports/${targetSlug}`);
  return true;
}
