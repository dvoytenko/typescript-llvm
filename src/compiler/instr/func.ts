import llvm from 'llvm-bindings';
import { Type, Value } from '../types/base';
import { FunctionArgs, FunctionArgValues, FunctionType } from '../types/func';

export class Function<Ret extends Type, Args extends FunctionArgs> {
  public readonly llFunc: llvm.Function;
  private readonly args: FunctionArgValues<Args>;

  constructor(
    module: llvm.Module,
    public readonly name: string,
    public readonly type: FunctionType<Ret, Args>
    ) {
    this.llFunc = llvm.Function.Create(
      type.llType,
      llvm.Function.LinkageTypes.ExternalLinkage,
      name,
      module
    );
    this.args = Object.fromEntries(Object.entries(type.args)
      .map(([name, type], index) => {
        return [name, new Value(type, this.llFunc.getArg(index))];
      })) as FunctionArgValues<Args>;
  }

  arg<A extends keyof Args>(name: A): Value<Args[A]> {
    return this.args[name];
  }
}
