import llvm from "llvm-bindings";
import { I32Type, I8Type, PointerType } from "./base";
import { JsString } from "./jsstring";
import { StructFields, StructType } from "./struct";

export interface VTableStruct extends StructFields {
  fields: VTableFields;
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

export class VTable extends StructType<VTableStruct> {
  constructor(context: llvm.LLVMContext, jsString: JsString) {
    super(context, "struct.VTable", {
      fields: new VTableFields(context, jsString),
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
