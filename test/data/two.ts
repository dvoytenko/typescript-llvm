
function add(a: number, b: number|null) {
  if (b === null) {
    return null;
  }
  return a + b;
}

export function main() {
  console.log('add(1, 2):', add(1, 2));
  console.log('add(1, null):', add(1, null));
  return 0;
}
