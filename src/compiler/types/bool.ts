import llvm from "llvm-bindings";
import { Type, Value } from "./base";

export class BoolType extends Type {
  constructor(context: llvm.LLVMContext) {
    super(context, llvm.IntegerType.get(context, 1));
  }

  constValue(v: boolean): Value<typeof this> {
    return new Value(this, llvm.ConstantInt.get(this.llType, v ? 1 : 0));
  }
}
