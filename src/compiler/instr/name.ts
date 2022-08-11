export const NAMES = false;

export function getName(name: string): string {
  return NAMES ? name : "";
}
