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
import { PointerType } from "./base";
import { I32Type } from "./inttype";
import { JsType, JsValue } from "./jsvalue";
import { StructFields } from "./struct";

export interface JsArrayFields extends StructFields {
  length: I32Type;
  arr: PointerType<PointerType<JsValue>>;
}

export class JsArray extends JsValue<JsType.ARRAY, JsArrayFields> {
  constructor(context: llvm.LLVMContext, jsValue: JsValue) {
    super(
      context,
      JsType.ARRAY,
      {
        length: new I32Type(context),
        arr: jsValue.pointerOf().pointerOf(),
      },
      "struct.JsArray"
    );
  }
}
