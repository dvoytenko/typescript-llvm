import llvm from "llvm-bindings";
import { Pointer, Type, Value } from "../types/base";

export class GlobalVar<T extends Type> {
  public readonly type: T;
  public readonly llVar: llvm.GlobalVariable;
  public readonly ptr: Pointer<T>;

  constructor(
    module: llvm.Module,
    public readonly name: string,
    public readonly value: Value<T>
  ) {
    this.type = value.type;
    // QQQ: fix llvm.Constant cast!?
    this.llVar = new llvm.GlobalVariable(
      module,
      /* type */ this.type.llType,
      /* isConstant */ true,
      /* linkage */ llvm.GlobalValue.LinkageTypes.PrivateLinkage,
      /* initializer */ value.llValue as llvm.Constant,
      name
    );
    this.ptr = new Pointer(this.type, this.llVar);
  }
}
