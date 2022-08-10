import llvm from "llvm-bindings";
import { ConstValue, Type } from "./base";

export class BoolType extends Type {
  constructor(context: llvm.LLVMContext) {
    super(context, llvm.IntegerType.get(context, 1));
  }

  override constValue(v: boolean | llvm.Constant): ConstValue<typeof this> {
    if (typeof v === "boolean") {
      return super.constValue(llvm.ConstantInt.get(this.llType, v ? 1 : 0));
    }
    return super.constValue(v);
  }
}
