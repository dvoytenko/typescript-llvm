import llvm from "llvm-bindings";
import { JsType, JsValue } from "./jsvalue";

export class JsNull extends JsValue<JsType.NULL, {}> {
  constructor(context: llvm.LLVMContext) {
    super(context, JsType.NULL, {}, "struct.JsNull");
  }
}
