
function sub(obj: any) {
  return obj.a - obj.b;
}

export function main() {
  console.log('sub({a: 7, b: 4):', sub({a: 7, b: 4}));
  return 0;
}
