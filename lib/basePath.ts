export function normalizeBasePath(raw?: string): string {
  const trimmed = (raw ?? '').trim();
  if (!trimmed || trimmed === '/') return '';
  const withLeading = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return withLeading.replace(/\/+$/, '');
}

export function getBasePath(): string {
  return normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH);
}

export function withBasePath(path: string, rawBasePath?: string): string {
  const basePath =
    rawBasePath !== undefined ? normalizeBasePath(rawBasePath) : getBasePath();
  if (!basePath) return path;
  if (!path.startsWith('/')) return path;
  if (path === basePath || path.startsWith(`${basePath}/`)) return path;
  if (path === '/') return `${basePath}/`;
  return `${basePath}${path}`;
}

export function resolveRuntimeDesignerUrl(
  origin: string,
  rawBasePath?: string
): string {
  const cleanOrigin = origin.replace(/\/+$/, '');
  const basePath =
    rawBasePath !== undefined ? normalizeBasePath(rawBasePath) : getBasePath();
  return `${cleanOrigin}${basePath}`;
}
