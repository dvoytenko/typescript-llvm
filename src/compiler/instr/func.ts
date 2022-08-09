import llvm from "llvm-bindings";
import { Type, Value } from "../types/base";
import { FunctionArgValues, FunctionType } from "../types/func";

export class Function<Ret extends Type, Args extends [...Type[]]> {
  public readonly llFunc: llvm.Function;
  public readonly args: FunctionArgValues<Args>;

  constructor(
    module: llvm.Module,
    public readonly name: string,
    public readonly type: FunctionType<Ret, Args>,
    attrs?: string[]
  ) {
    this.llFunc = llvm.Function.Create(
      type.llType,
      llvm.Function.LinkageTypes.ExternalLinkage,
      name,
      module
    );
    if (attrs) {
      for (const attr of attrs) {
        this.llFunc.addFnAttr(attr);
      }
    }
    this.args = type.args.map((type, index) => {
      return new Value(type, this.llFunc.getArg(index));
    }) as FunctionArgValues<Args>;
  }

  verify() {
    if (llvm.verifyFunction(this.llFunc)) {
      console.log(`${"\x1b[31m"}${this.name}: FAILED${"\x1b[0m"}`);
      //   throw new Error(`Verifying function failed: ${funcName}`);
    } else {
      // console.log(`${"\x1b[34m"}${this.name}: SUCCESS${"\x1b[0m"}`);
    }
  }
}
