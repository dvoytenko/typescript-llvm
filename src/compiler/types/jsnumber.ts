import llvm from 'llvm-bindings';
import {BoxedType, I32Type, Pointer, PointerType, Type, Value} from './base';
import { JsNullType } from './jsnull';
import { JsType, JsValueType } from './jsvalue';
import { StructType } from './struct';

export class JsNumberType extends JsValueType<JsType.NUMBER, {
  value: I32Type
}> implements BoxedType<I32Type> {
  constructor(context: llvm.LLVMContext) {
    super(context, JsType.NUMBER, {value: new I32Type(context)});
  }

  // TODO: move to JsPrimitiveType?
  unboxLoad(builder: llvm.IRBuilder, ptr: Pointer<typeof this>): Value<I32Type> {
    return this.load(builder, ptr, "value");
  }

  // TODO: move to JsPrimitiveType?
  loadUnboxed(builder: llvm.IRBuilder, ptr: Pointer<typeof this>): Value<I32Type> {
    return this.load(builder, ptr, "value");
  }

  // TODO: move to JsPrimitiveType?
  storeBoxed(builder: llvm.IRBuilder, ptr: Pointer<typeof this>, value: Value<I32Type>) {
    const i32 = new I32Type(this.context);
    this.storeStruct(builder, ptr, {
      jsType: new Value(i32, llvm.ConstantInt.get(i32.llType, this.jsType)),
      value,
    });
  }

  boxStore(builder: llvm.IRBuilder, ptr: Pointer<typeof this>, unboxed: Value<I32Type>) {
    const i32 = new I32Type(this.context);
    this.storeStruct(builder, ptr, {
      jsType: new Value(i32, llvm.ConstantInt.get(i32.llType, this.jsType)),
      value: unboxed,
    });
  }

  box(unboxed: number|Value<I32Type>): Value<typeof this> {
    const i32 = new I32Type(this.context);
    if (typeof unboxed === 'number') {
      unboxed = i32.constValue(unboxed);
    }
    // QQQQ: can we ever guarantee this to be a constant value?
    return this.createConst({
      jsType: new Value(i32, llvm.ConstantInt.get(i32.llType, this.jsType)),
      value: unboxed,
    });
  }
}
