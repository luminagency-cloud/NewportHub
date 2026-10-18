/** Page number from ?page=, clamped to 1..500. */
export function pageParam(url: URL): number {
  const n = Number.parseInt(url.searchParams.get('page') ?? '1', 10);
  return Number.isFinite(n) ? Math.min(Math.max(n, 1), 500) : 1;
}
