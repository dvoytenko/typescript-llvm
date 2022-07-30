import llvm from "llvm-bindings";
import { JsType, JsValueType } from "./jsvalue";

export class JsNullType extends JsValueType<JsType.NULL, {}> {
  constructor(context: llvm.LLVMContext) {
    super(context, JsType.NULL, {});
  }
}
