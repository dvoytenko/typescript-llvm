import llvm from "llvm-bindings";
import { Instr } from "../instr";
import { Types } from "../types";
import { I8Type, IntType, Pointer, PointerType, Value } from "../types/base";
import { JsValueType } from "../types/jsvalue";

export interface Debug {
  printf: (fmt: string, args: (Value<any> | llvm.Value)[]) => void;
  debugValue: (value: Value<any>) => Pointer<I8Type>;
}

export function debugFactory(
  builder: llvm.IRBuilder,
  module: llvm.Module,
  instr: Instr,
  types: Types
): Debug {
  const snprintf = snprintfFactory(builder, module);
  const puts = putsFactory(builder, module);
  const debugValue = debugValueFactory(instr, types, snprintf);
  return {
    debugValue,
    printf: printfFactory(builder, snprintf, puts),
  };
}

function debugValueFactory(
  instr: Instr,
  types: Types,
  snprintf: llvm.Function
) {
  const { builder } = instr;

  const debugJsvFunc = instr.func(
    "jsValue_debug",
    types.func(types.i8.pointerOf(), [types.jsValue.pointerOf()])
  );

  return (value: Value<any>) => {
    const strPtr = instr.malloc("s", types.i8, types.i64.constValue(1000));
    if (value.type instanceof IntType) {
      const fmtInt = builder.CreateGlobalStringPtr("<i%d %d>", "fmt.int");
      builder.CreateCall(
        snprintf,
        [
          strPtr.llValue,
          builder.getInt32(1000),
          builder.CreateInBoundsGEP(builder.getInt8PtrTy(), fmtInt, []),
          types.i32.constValue(value.type.bits).llValue,
          value.llValue,
        ],
        "deb"
      );
      return strPtr;
    }

    if (
      value.type instanceof PointerType &&
      value.type.toType instanceof JsValueType
    ) {
      const jsv = instr.cast("jsv", value, types.jsValue);
      return instr.call("jsv_deb", debugJsvFunc, [jsv]);
    }

    const unk = builder.CreateGlobalStringPtr("(unknown)", "fmt.unk");
    return new Pointer(types.i8, unk);
  };
}

function printfFactory(
  builder: llvm.IRBuilder,
  snprintf: llvm.Function,
  puts: llvm.Function
) {
  return (fmt: string, args: (Value<any> | llvm.Value)[]) => {
    const fmtPtr = builder.CreateGlobalStringPtr(fmt, "fmt");
    const strPtr = builder.CreateAlloca(
      builder.getInt8Ty(),
      builder.getInt32(1000),
      "s"
    );
    builder.CreateCall(
      snprintf,
      [
        strPtr,
        builder.getInt32(1000),
        builder.CreateInBoundsGEP(builder.getInt8PtrTy(), fmtPtr, []),
        ...args.map((v) => (v instanceof Value ? v.llValue : v)),
      ],
      "s"
    );
    builder.CreateCall(puts, [strPtr], "printf");
  };
}

function snprintfFactory(builder: llvm.IRBuilder, module: llvm.Module) {
  // declare i32 @snprintf(i8*, i32, i8*, ...)
  const functionType = llvm.FunctionType.get(
    builder.getInt32Ty(),
    [builder.getInt8PtrTy(), builder.getInt32Ty(), builder.getInt8PtrTy()],
    true
  );
  const func = llvm.Function.Create(
    functionType,
    llvm.Function.LinkageTypes.ExternalLinkage,
    "snprintf",
    module
  );
  return func;
}

function putsFactory(builder: llvm.IRBuilder, module: llvm.Module) {
  // declare i32 @puts(i8*)
  const functionType = llvm.FunctionType.get(
    builder.getInt32Ty(),
    [builder.getInt8PtrTy()],
    false
  );
  const func = llvm.Function.Create(
    functionType,
    llvm.Function.LinkageTypes.ExternalLinkage,
    "puts",
    module
  );
  return func;
}
