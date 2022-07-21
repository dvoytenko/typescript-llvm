
function add(obj: {a: number; b: number}) {
  return obj.a * 5 + obj.b * 6;
}

export function main() {
  console.log('add({a: 3, b: 4):', add({b: 3, a: 4}));
  return 0;
}
