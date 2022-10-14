/*
Copyright 2022 Google LLC

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    https://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

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
