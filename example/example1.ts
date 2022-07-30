export function test1(test: number | string | null): number | undefined {
  if (typeof test === "number") {
    const testString = test ** 2;
    return testString;
  }
  return undefined;
}

// export function test2(test: number): number {
//   if (typeof test === 'number') {
//     const testValue = test;
//     return testValue;
//   }
//   return test;
// }
