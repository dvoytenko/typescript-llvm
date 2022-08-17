import llvm from "llvm-bindings";
import { PrimitiveType, Type, Value, VoidType } from "../types";
import { FunctionArgValues, FunctionType } from "../types/func";
import { getName } from "./name";

export type RetType = <T extends PrimitiveType>(
  func: Function<T, any>,
  value: Value<T>
) => void;

export type CallType = <
  Ret extends PrimitiveType,
  Args extends [...PrimitiveType[]]
>(
  name: string,
  func: Function<Ret, Args>,
  args: FunctionArgValues<Args>
) => Value<Ret>;

export type CallVoidType = <
  Ret extends VoidType,
  Args extends [...PrimitiveType[]]
>(
  func: Function<Ret, Args>,
  args: FunctionArgValues<Args>
) => void;

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
      // TODO: Critical for optimization. See https://github.com/ApsarasX/llvm-bindings/issues/23.
      //   To do a temporary workaround, use "llvm-bindings": "file:../llvm-bindings"
      //   in the package.json.
      // for (const attr of attrs) {
      //   this.llFunc.addFnAttr(attr);
      // }
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

export function retFactory(builder: llvm.IRBuilder) {
  return <T extends Type>(func: Function<T, any>, value: Value<T>) => {
    builder.CreateRet(value.llValue);
  };
}

export function callFactory(builder: llvm.IRBuilder) {
  return <Ret extends Type, Args extends [...Type[]]>(
    name: string,
    func: Function<Ret, Args>,
    args: FunctionArgValues<Args>
  ) => {
    const res = builder.CreateCall(
      func.llFunc,
      args.map((v) => v.llValue),
      getName(name)
    );
    return new Value(func.type.retType, res);
  };
}

export function callVoidFactory(builder: llvm.IRBuilder) {
  return <Ret extends VoidType, Args extends [...Type[]]>(
    func: Function<Ret, Args>,
    args: FunctionArgValues<Args>
  ) => {
    builder.CreateCall(
      func.llFunc,
      args.map((v) => v.llValue)
    );
  };
}
