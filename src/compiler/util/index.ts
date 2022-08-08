export function notNull<T>(v: T | null | undefined): v is T {
  return v != null;
}
