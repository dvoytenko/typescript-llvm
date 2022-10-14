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
import { PrimitiveType, Type, Value } from "./base";

export type FunctionArgValues<Args extends Type[]> = {
  [index in keyof Args]: Value<Args[index]>;
};

export class FunctionType<
  Ret extends PrimitiveType,
  Args extends [...PrimitiveType[]]
> extends Type {
  constructor(
    context: llvm.LLVMContext,
    public readonly retType: Ret,
    public readonly args: Args
  ) {
    super(
      context,
      llvm.FunctionType.get(
        retType.llType,
        args.map((arg) => arg.llType),
        false
      )
    );
  }
}
