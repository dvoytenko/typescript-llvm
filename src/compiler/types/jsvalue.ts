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
import { I32Type } from "./inttype";
import { StructFields, StructType } from "./struct";

// TODO: move to jslib

export enum JsType {
  UNKNOWN = -1,
  UNDEFINED = 0,
  NULL,
  BOOL,
  NUMBER,
  STRING,
  SYMBOL,
  FUNCTION,
  ARRAY,
  OBJECT,
  BIGINT,
  // Extensions?
  // INT32,
  // UINT32,
  // DATE,
  // REGEXP,
  // ERROR,
}

interface JsTypeFields extends StructFields {
  jsType: I32Type;
}

export class JsValue<
  JST extends JsType = any,
  Fields extends StructFields = {}
> extends StructType<JsTypeFields & Fields> {
  constructor(
    context: llvm.LLVMContext,
    public readonly jsType: JST,
    fields: Fields,
    name?: string
  ) {
    super(
      context,
      name ?? `struct.JsValue${jsType !== JsType.UNKNOWN ? jsType : ""}`,
      {
        jsType: new I32Type(context),
        ...fields,
      }
    );
  }
}
