import llvm from 'llvm-bindings';
import {Pointer, Type, Value} from './base';

export interface FunctionArgs {
  [name: string]: Type;
}

export type FunctionArgValues<T extends FunctionArgs> = {
  [name in keyof T]: Value<T[name]>;
}

/*QQQQ
type Fun5Args = [a: StrType, b: NumType, c: NumType];
const fun5 = funType2<Fun5Args>([strType, numType, numType]);
fun5.args;
const a0 = fun5.args[0];
const a1 = fun5.args[1];
const a2 = fun5.args[2];
type Vals5 = FunArgVals<Fun5Args>;
fun5.invoke([{type: strType}, {type: numType}, {type: numType}]);

const fun6 = funType2([strType, numType, numType] as const);


function funType3<Args extends [...any[]]>(args: [...Args]): FunType2<Args> {
  return {
    args,
    invoke() {},
  };
}
*/

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
