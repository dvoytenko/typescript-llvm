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
import { ConstValue, Pointer, Type } from "../types/base";

export class GlobalVar<T extends Type> {
  public readonly type: T;
  public readonly llVar: llvm.GlobalVariable;
  public readonly ptr: Pointer<T>;

  constructor(
    module: llvm.Module,
    public readonly name: string,
    public readonly value: ConstValue<T>
  ) {
    this.type = value.type;
    this.llVar = new llvm.GlobalVariable(
      module,
      /* type */ this.type.llType,
      /* isConstant */ true,
      /* linkage */ llvm.GlobalValue.LinkageTypes.PrivateLinkage,
      /* initializer */ value.llValue,
      name
    );
    this.ptr = new Pointer(this.type, this.llVar);
  }
}
