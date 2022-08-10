import llvm from "llvm-bindings";
import { ConstValue, Pointer, PointerType } from "./base";
import { I32Type, I8Type } from "./inttype";
import { JsType, JsValue } from "./jsvalue";

export class JsString extends JsValue<
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

  constString(len: number, ptr: Pointer<I8Type>): ConstValue<typeof this> {
    return this.constStruct({
      jsType: this.fields.jsType.constValue(this.jsType),
      length: this.fields.length.constValue(len),
      chars: ptr.asConst(),
    });
  }
}
