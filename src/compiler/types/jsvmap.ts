import llvm from "llvm-bindings";
import { Types } from ".";
import { Instr } from "../instr";
import { Pointer, PointerType } from "./base";
import { I32Type } from "./inttype";
import { JsString } from "./jsstring";
import { JsValue } from "./jsvalue";
import { StructFields, StructType } from "./struct";

interface MapFields extends StructFields {
  length: I32Type;
  entries: PointerType<EntryType>;
}

interface EntryFields extends StructFields {
  key: PointerType<JsString>;
  value: PointerType<JsValue>;
}

export class JsvMap extends StructType<MapFields> {
  constructor(context: llvm.LLVMContext, jsString: JsString, jsValue: JsValue) {
    super(context, "struct.JsvMap", {
      length: new I32Type(context),
      entries: new EntryType(context, jsString, jsValue).pointerOf(),
    });
  }

  constr(instr: Instr, types: Types, ptr: Pointer<typeof this>) {
    const entriesPtr = instr.malloc(
      "f_entries",
      this.fields.entries.toType,
      // QQQ: is there such a thing in a 0-length pointer?
      types.i64.constValue(100)
    );
    this.storeStruct(instr.builder, ptr, {
      length: types.i32.constValue(0),
      entries: entriesPtr,
    });
  }
}

class EntryType extends StructType<EntryFields> {
  constructor(context: llvm.LLVMContext, jsString: JsString, jsValue: JsValue) {
    super(context, "struct.JsvMapEntry", {
      key: jsString.pointerOf(),
      value: jsValue.pointerOf(),
    });
  }
}
