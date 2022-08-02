import llvm from "llvm-bindings";
import { ConstValue, Type } from "./base";

export class BoolType extends Type {
  constructor(context: llvm.LLVMContext) {
    super(context, llvm.IntegerType.get(context, 1));
  }

  constValue(v: boolean): ConstValue<typeof this> {
    return new ConstValue(this, llvm.ConstantInt.get(this.llType, v ? 1 : 0));
  }
}
