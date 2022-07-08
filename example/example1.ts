
export function main(test: number|string|null): number|undefined {
  if (typeof test === 'number') {
    const testString = test;
    return testString;
  }
  return undefined;
}
