import llvm from "llvm-bindings";
import { Type, Value } from "./base";
import { JsType, JsValueType } from "./jsvalue";
import { StructType } from "./struct";

export class JsNullType extends JsValueType<JsType.NULL, {}> {
  constructor(context: llvm.LLVMContext) {
    super(context, JsType.NULL, {});
  }
}
