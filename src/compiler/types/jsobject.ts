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
import { Pointer, PointerType } from "./base";
import { JsType, JsValue } from "./jsvalue";
import { JsvMap } from "./jsvmap";
import { StructFields, StructType } from "./struct";
import { VTable } from "./vtable";

export interface JsObjectFields extends StructFields {
  vtable: PointerType<VTable>;
  map: PointerType<JsvMap>;
  cust: StructType<any>;
}

export class JsObject extends JsValue<JsType.OBJECT, JsObjectFields> {
  constructor(
    context: llvm.LLVMContext,
    vtableType: VTable,
    jsvMap: JsvMap,
    name?: string,
    more?: StructFields
  ) {
    super(
      context,
      JsType.OBJECT,
      {
        vtable: vtableType.pointerOf(),
        map: jsvMap.pointerOf(),
        ...more,
      } as JsObjectFields,
      name ?? "struct.JsObject"
    );
  }
}

export class JsCustObject extends JsObject {
  constructor(
    context: llvm.LLVMContext,
    vtableType: VTable,
    jsvMap: JsvMap,
    name: string,
    public cust: StructType<any>,
    public vtablePtr: Pointer<VTable>
  ) {
    super(context, vtableType, jsvMap, name, { cust });
  }
}
