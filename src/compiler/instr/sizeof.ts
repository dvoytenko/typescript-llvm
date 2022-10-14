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
import { I64Type, Types, ConstValue, Type } from "../types";
import { getName } from "./name";

export type SizeofType = (type: Type) => ConstValue<I64Type>;

export function sizeofFactory(builder: llvm.IRBuilder, types: Types) {
  const { i64 } = types;
  return (type: Type): ConstValue<I64Type> => {
    const arrayType = llvm.PointerType.get(type.llType, 0);
    const gep = builder.CreateGEP(
      type.llType,
      llvm.Constant.getNullValue(arrayType),
      [builder.getInt32(1)],
      getName(`${type.typeName}_sizeof_ptr`)
    );
    const intVal = builder.CreatePtrToInt(
      gep,
      i64.llType,
      getName(`${type.typeName}_sizeof`)
    );
    return i64.constValue(intVal as llvm.Constant);
  };
}
