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
import { I32Type, I8Type } from "./inttype";
import { JsString } from "./jsstring";
import { StructFields, StructType } from "./struct";

export interface VTableStruct extends StructFields {
  fields: VTableFields;
  itable: VTableITable;
}

export interface VTableFieldsStruct extends StructFields {
  length: I32Type;
  fields: PointerType<VTableField>;
}

export interface VTableFieldStruct extends StructFields {
  field: PointerType<JsString>;
  jsType: I32Type;
  // Have to use i8 here. For some reason, C cannot create structs with i1.
  boxed: I8Type;
  offset: I32Type;
}

export interface VTableITableStruct extends StructFields {
  autoId: I32Type;
  length: I32Type;
  ifcs: PointerType<VTableIfc>;
}

export interface VTableIfcStruct extends StructFields {
  id: I32Type;
  fields: PointerType<VTableIfcField>;
}

export interface VTableIfcFieldStruct extends StructFields {
  jsType: I32Type;
  // Have to use i8 here. For some reason, C cannot create structs with i1.
  boxed: I8Type;
  offset: I32Type;
}

export class VTable extends StructType<VTableStruct> {
  constructor(context: llvm.LLVMContext, jsString: JsString) {
    super(context, "struct.VTable", {
      fields: new VTableFields(context, jsString),
      itable: new VTableITable(context),
    });
  }
}

export class VTableFields extends StructType<VTableFieldsStruct> {
  constructor(context: llvm.LLVMContext, jsString: JsString) {
    super(context, "struct.VTableFields", {
      length: new I32Type(context),
      fields: new VTableField(context, jsString).pointerOf(),
    });
  }
}

export class VTableField extends StructType<VTableFieldStruct> {
  constructor(context: llvm.LLVMContext, jsString: JsString) {
    super(context, "struct.VTableField", {
      field: jsString.pointerOf(),
      jsType: new I32Type(context),
      boxed: new I8Type(context),
      offset: new I32Type(context),
    });
  }
}

export class VTableITable extends StructType<VTableITableStruct> {
  constructor(context: llvm.LLVMContext) {
    super(context, "struct.VTableITable", {
      autoId: new I32Type(context),
      length: new I32Type(context),
      ifcs: new VTableIfc(context).pointerOf(),
    });
  }
}

export class VTableIfc extends StructType<VTableIfcStruct> {
  constructor(context: llvm.LLVMContext) {
    super(context, "struct.VTableIfc", {
      id: new I32Type(context),
      fields: new VTableIfcField(context).pointerOf(),
    });
  }
}

export class VTableIfcField extends StructType<VTableIfcFieldStruct> {
  constructor(context: llvm.LLVMContext) {
    super(context, "struct.VTableIfcField", {
      jsType: new I32Type(context),
      boxed: new I8Type(context),
      offset: new I32Type(context),
    });
  }
}
