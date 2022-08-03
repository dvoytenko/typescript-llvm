import llvm from "llvm-bindings";
import { BoxedType, I32Type, Pointer, Value } from "./base";
import { JsType, JsValueType } from "./jsvalue";

export class JsNumberType
  extends JsValueType<
    JsType.NUMBER,
    {
      // TODO: switch to double
      value: I32Type;
    }
  >
  implements BoxedType<I32Type>
{
  public readonly unboxedType: I32Type;

  constructor(context: llvm.LLVMContext) {
    super(
      context,
      JsType.NUMBER,
      { value: new I32Type(context) },
      "struct.JsNumber"
    );
    this.unboxedType = new I32Type(context);
  }

  constValue(v: number): Value<typeof this> {
    return this.createConst({
      jsType: this.fields.jsType.constValue(this.jsType),
      value: this.fields.value.constValue(v),
    });
  }

  // TODO: move to JsPrimitiveType?
  unboxLoad(
    builder: llvm.IRBuilder,
    ptr: Pointer<typeof this>
  ): Value<I32Type> {
    return this.load(builder, ptr, "value");
  }

  // TODO: move to JsPrimitiveType?
  loadUnboxed(
    builder: llvm.IRBuilder,
    ptr: Pointer<typeof this>
  ): Value<I32Type> {
    return this.load(builder, ptr, "value");
  }

  // TODO: move to JsPrimitiveType?
  storeBoxed(
    builder: llvm.IRBuilder,
    ptr: Pointer<typeof this>,
    value: Value<I32Type>
  ) {
    this.storeStruct(builder, ptr, {
      jsType: this.fields.jsType.constValue(this.jsType),
      value,
    });
  }

  boxStore(
    builder: llvm.IRBuilder,
    ptr: Pointer<typeof this>,
    unboxed: Value<I32Type>
  ) {
    const i32 = new I32Type(this.context);
    this.storeStruct(builder, ptr, {
      jsType: new Value(i32, llvm.ConstantInt.get(i32.llType, this.jsType)),
      value: unboxed,
    });
  }

  box(unboxed: number | Value<I32Type>): Value<typeof this> {
    const i32 = new I32Type(this.context);
    if (typeof unboxed === "number") {
      unboxed = i32.constValue(unboxed);
    }
    // QQQ: can we ever guarantee this to be a constant value?
    return this.createConst({
      jsType: new Value(i32, llvm.ConstantInt.get(i32.llType, this.jsType)),
      value: unboxed,
    });
  }
}
