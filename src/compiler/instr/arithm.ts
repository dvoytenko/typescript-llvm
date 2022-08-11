import llvm from "llvm-bindings";
import { BoolType, IntType, Types, Value } from "../types";
import { getName } from "./name";

export type AddType = <T extends IntType<any>>(
  name: string,
  a: Value<T>,
  b: Value<T>
) => Value<T>;

export type SubType = <T extends IntType<any>>(
  name: string,
  a: Value<T>,
  b: Value<T>
) => Value<T>;

export type IcmpEqType = <T extends IntType<any>>(
  name: string,
  a: Value<T>,
  b: Value<T>
) => Value<BoolType>;

export function addFactory(builder: llvm.IRBuilder) {
  return <T extends IntType<any>>(name: string, a: Value<T>, b: Value<T>) => {
    const res = builder.CreateAdd(a.llValue, b.llValue, getName(name));
    return new Value(a.type, res);
  };
}

export function subFactory(builder: llvm.IRBuilder) {
  return <T extends IntType<any>>(name: string, a: Value<T>, b: Value<T>) => {
    const res = builder.CreateSub(a.llValue, b.llValue, getName(name));
    return new Value(a.type, res);
  };
}

export function icmpEqFactory(types: Types, builder: llvm.IRBuilder) {
  return <T extends IntType<any>>(name: string, a: Value<T>, b: Value<T>) => {
    const res = builder.CreateICmpEQ(a.llValue, b.llValue, getName(name));
    return new Value(types.bool, res);
  };
}
