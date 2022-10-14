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
import { BoxedType, PrimitiveType, Pointer, Type, Value } from "../types";
import { getName } from "./name";

export type LoadType = <T extends PrimitiveType>(
  name: string,
  ptr: Pointer<T>
) => Value<T>;

export type StoreType = <T extends PrimitiveType>(
  ptr: Pointer<T>,
  value: Value<T>
) => void;

export type LoadUnboxedType = <T extends Type & BoxedType<any>>(
  ptr: Pointer<T>
) => Value<T extends BoxedType<infer BT> ? BT : never>;

export type StoreBoxedType = <T extends Type & BoxedType<any>>(
  ptr: Pointer<T>,
  value: Value<T extends BoxedType<infer BT> ? BT : never>
) => Pointer<T>;

export function loadFactory(builder: llvm.IRBuilder) {
  return <T extends Type>(name: string, ptr: Pointer<T>) => {
    const toType = ptr.type.toType;
    const res = builder.CreateLoad(toType.llType, ptr.llValue, getName(name));
    return new Value(toType, res);
  };
}

export function storeFactory(builder: llvm.IRBuilder) {
  return <T extends Type>(ptr: Pointer<T>, value: Value<T>) => {
    builder.CreateStore(value.llValue, ptr.llValue);
  };
}

export function loadUnboxedFactory(builder: llvm.IRBuilder) {
  return <T extends Type & BoxedType<any>>(ptr: Pointer<T>) => {
    const toType = ptr.type.toType;
    return toType.loadUnboxed(builder, ptr);
  };
}

export function storeBoxedFactory(builder: llvm.IRBuilder) {
  return <T extends Type & BoxedType<any>>(
    ptr: Pointer<T>,
    value: Value<T extends BoxedType<infer BT> ? BT : never>
  ) => {
    const toType = ptr.type.toType;
    toType.storeBoxed(builder, ptr, value);
    return ptr;
  };
}
