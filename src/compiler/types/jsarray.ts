import llvm from "llvm-bindings";
import { I32Type, PointerType } from "./base";
import { JsType, JsValueType } from "./jsvalue";
import { StructFields } from "./struct";

export interface JsArrayFields extends StructFields {
  length: I32Type;
  arr: PointerType<PointerType<JsValueType<any, any>>>;
}

export class JsArray extends JsValueType<JsType.ARRAY, JsArrayFields> {
  constructor(context: llvm.LLVMContext, jsValue: JsValueType<any, any>) {
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
