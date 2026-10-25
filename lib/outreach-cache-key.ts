export function getQueryCacheKey(searchParams: URLSearchParams): string {
  const sortedPairs: string[] = [];
  searchParams.forEach((value, key) => {
    sortedPairs.push(`${key}=${value}`);
  });
  sortedPairs.sort();
  return sortedPairs.join('&');
}
