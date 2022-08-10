import llvm from "llvm-bindings";
import { PointerType } from "./base";
import { I32Type } from "./inttype";
import { JsType, JsValueType } from "./jsvalue";
import { StructFields } from "./struct";

export interface JsArrayFields extends StructFields {
  length: I32Type;
  arr: PointerType<PointerType<JsValueType>>;
}

export class JsArray extends JsValueType<JsType.ARRAY, JsArrayFields> {
  constructor(context: llvm.LLVMContext, jsValue: JsValueType) {
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
