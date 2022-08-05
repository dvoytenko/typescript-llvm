
function sub(obj: {a: number; b: number}) {
  return obj.a - obj.b;
}

export function main() {
  console.log('sub({b: 4, a: 7}):', sub({b: 4, a: 7}));
  return 0;
}
