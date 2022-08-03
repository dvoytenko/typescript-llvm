import llvm from "llvm-bindings";
import { Instr } from "../instr";
import { I32Type, I8Type, PointerType, Value } from "./base";
import { JsType, JsValueType } from "./jsvalue";

export class JsString extends JsValueType<
  JsType.STRING,
  {
    length: I32Type;
    // TODO: switch to i16
    chars: PointerType<I8Type>;
  }
> {
  constructor(context: llvm.LLVMContext) {
    super(
      context,
      JsType.STRING,
      {
        length: new I32Type(context),
        chars: new I8Type(context).pointerOf(),
      },
      "struct.JsString"
    );
  }

  constValue(instr: Instr, s: string): Value<typeof this> {
    // TODO: all of these is wrong!
    const len = s.length;
    const ptr = instr.globalStringPtr("jss", s);
    return this.createConst({
      jsType: this.fields.jsType.constValue(this.jsType),
      length: this.fields.length.constValue(len),
      chars: ptr,
    });
  }
}
