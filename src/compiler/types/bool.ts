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
import { ConstValue, PrimitiveType } from "./base";

export class BoolType extends PrimitiveType {
  constructor(context: llvm.LLVMContext) {
    super(context, llvm.IntegerType.get(context, 1));
  }

  override constValue(v: boolean | llvm.Constant): ConstValue<typeof this> {
    if (typeof v === "boolean") {
      return super.constValue(llvm.ConstantInt.get(this.llType, v ? 1 : 0));
    }
    return super.constValue(v);
  }
}
