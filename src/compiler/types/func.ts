import llvm from "llvm-bindings";
import { Pointer, Type, Value } from "./base";

export type FunctionArgValues<Args extends Type[]> = {
  [index in keyof Args]: Value<Args[index]>;
};

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


function funType3<>(args: [...Args]): FunType2<Args> {
  return {
    args,
    invoke() {},
  };
}
*/

export class FunctionType<
  Ret extends Type,
  Args extends [...Type[]]
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
