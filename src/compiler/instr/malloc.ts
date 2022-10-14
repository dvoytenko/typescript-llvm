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
import { I64Type, Pointer, PointerType, Type, Value } from "../types";
import { getName } from "./name";
import { SizeofType } from "./sizeof";

export type MallocType = <T extends Type>(
  name: string,
  type: T,
  arraySize?: Value<I64Type> | null
) => Pointer<T>;

export function mallocFactory(
  builder: llvm.IRBuilder,
  module: llvm.Module,
  sizeof: SizeofType
) {
  // declare i8* @malloc(i64)
  const functionType = llvm.FunctionType.get(
    builder.getInt8PtrTy(),
    [builder.getInt64Ty()],
    false
  );
  const func = llvm.Function.Create(
    functionType,
    llvm.Function.LinkageTypes.ExternalLinkage,
    "malloc",
    module
  );
  return <T extends Type>(
    name: string,
    type: T,
    arraySize?: Value<I64Type> | null
  ) => {
    const pointerType = PointerType.of(type);
    const size = sizeof(type);
    const ptr = builder.CreateBitCast(
      builder.CreateCall(
        func,
        [arraySize?.llValue ?? size.llValue],
        getName(`${name}_ptr`)
      ),
      pointerType.llType,
      getName(name)
    );
    return new Pointer(type, ptr);
  };
}
