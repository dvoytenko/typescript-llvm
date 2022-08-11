import llvm from "llvm-bindings";
import { PrimitiveType, Type, Value } from "./base";

export type FunctionArgValues<Args extends Type[]> = {
  [index in keyof Args]: Value<Args[index]>;
};

export class FunctionType<
  Ret extends PrimitiveType,
  Args extends [...PrimitiveType[]]
> extends Type {
  constructor(
    context: llvm.LLVMContext,
    public readonly retType: Ret,
    public readonly args: Args
  ) {
    super(
      context,
      llvm.FunctionType.get(
        retType.llType,
        args.map((arg) => arg.llType),
        false
      )
    );
  }
}
