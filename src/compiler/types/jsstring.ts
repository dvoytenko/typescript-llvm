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
import { ConstValue, Pointer, PointerType } from "./base";
import { I32Type, I8Type } from "./inttype";
import { JsType, JsValue } from "./jsvalue";

export class JsString extends JsValue<
  JsType.STRING,
  {
    length: I32Type;
    // TODO: switch to i16
    chars: PointerType<I8Type>;
  }
> {
  constructor(context: llvm.LLVMContext) {
    super(
      context,
      JsType.STRING,
      {
        length: new I32Type(context),
        chars: new I8Type(context).pointerOf(),
      },
      "struct.JsString"
    );
  }

  constString(len: number, ptr: Pointer<I8Type>): ConstValue<typeof this> {
    return this.constStruct({
      jsType: this.fields.jsType.constValue(this.jsType),
      length: this.fields.length.constValue(len),
      chars: ptr.asConst(),
    });
  }
}
