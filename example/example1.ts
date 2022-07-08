
export function main(test: number|string|null): string|undefined {
  if (typeof test === 'string') {
    const testString = test;
    return testString;
  }
  return undefined;
}
