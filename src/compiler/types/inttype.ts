import llvm from "llvm-bindings";
import { ConstValue, PrimitiveType } from "./base";

export type IntBits = 8 | 16 | 32 | 64;

export class IntType<B extends IntBits> extends PrimitiveType {
  constructor(context: llvm.LLVMContext, public readonly bits: B) {
    super(context, llvm.IntegerType.get(context, bits));
  }

  override constValue(v: number | llvm.Constant): ConstValue<typeof this> {
    if (typeof v === "number") {
      return super.constValue(llvm.ConstantInt.get(this.llType, v));
    }
    return super.constValue(v);
  }
}

export class I8Type extends IntType<8> {
  constructor(context: llvm.LLVMContext) {
    super(context, 8);
  }
}

export class I32Type extends IntType<32> {
  constructor(context: llvm.LLVMContext) {
    super(context, 32);
  }
}

export class I64Type extends IntType<64> {
  constructor(context: llvm.LLVMContext) {
    super(context, 64);
  }
}
