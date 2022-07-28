import llvm from 'llvm-bindings';
import {Pointer, Type, Value} from './base';

export interface FunctionArgs {
  [name: string]: Type;
}

export type FunctionArgValues<T extends FunctionArgs> = {
  [name in keyof T]: Value<T[name]>;
}

export class FunctionType<Ret extends Type, Args extends FunctionArgs> extends Type {
  private argNames: (keyof Args)[];

  constructor(
    context: llvm.LLVMContext,
    public readonly retType: Ret,
    public readonly args: Args,
    ) {
    super(
      context,
      llvm.FunctionType.get(
        retType.llType,
        Object.entries(args).map(([, type]) => type.llType),
        false
      )
    );
    this.argNames = Object.entries(args).map(([name]) => name);
  }

  createArgValues(values: FunctionArgValues<Args>): Value<any>[] {
    return this.argNames.map(name => values[name]);
  }
}
