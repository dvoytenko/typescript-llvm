
function sub(obj: {a: number; b: number}) {
  return obj.a - obj.b + obj.a;
}

export function main() {
  console.log('sub({a: 7, b: 4):', sub({a: 7, b: 4}));
  return 0;
}
