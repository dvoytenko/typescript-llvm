import llvm from 'llvm-bindings';
import { Instr } from '../instr';
import { Types } from '../types';
import { I8Type, IntType, Pointer, PointerType, Value } from '../types/base';
import { JsType, JsValueType } from '../types/jsvalue';

export interface Debug {
  printf: (fmt: string, args: (Value<any>|llvm.Value)[]) => void;
  debugValue: (value: Value<any>) => Pointer<I8Type>;
}

export function debugFactory(builder: llvm.IRBuilder, module: llvm.Module, instr: Instr, types: Types): Debug {
  const snprintf = snprintfFactory(builder, module);
  const puts = putsFactory(builder, module);
  const debugValue = debugValueFactory(instr, types, snprintf);
  return {
    debugValue,
    printf: printfFactory(builder, snprintf, puts, debugValue),
  };
}

function debugValueFactory(instr: Instr, types: Types, snprintf: llvm.Function) {
  const { builder } = instr;

  const debugJsvFunc = (() => {
    const functionType = types.func(
      types.i8.pointerOf(),
      {
        v: types.jsValue.pointerOf(),
      }
    );
    const func = instr.func("debug_jsv", functionType);
    instr.insertPoint(instr.block(func, 'entry'));

    const arg = func.arg("v");
    const jsType = arg.type.toType.loadJsType(builder, arg);
    const strPtr = instr.malloc('s', types.i8, types.i64.constValue(1000));

    const nullBlock = instr.block(func, 'jsnull');
    const numBlock = instr.block(func, 'jsnum');
    const unkBlock = instr.block(func, 'jsunk');
    // TODO...

    instr.switchBr(
      jsType,
      unkBlock,
      [
        {
          on: types.i32.constValue(JsType.NULL),
          block: nullBlock,
        },
        {
          on: types.i32.constValue(JsType.NUMBER),
          block: numBlock,
        },
      ]
    );

    instr.insertPoint(nullBlock);
    const fmtNull = instr.globalStringPtr("fmt.jsnull", "JSV<null>");
    instr.ret(func, fmtNull);

    instr.insertPoint(numBlock);
    const ptrNum = instr.cast('jsn', arg, types.jsNumber);
    const unboxedNum = instr.loadUnboxed(ptrNum);
    const fmtNum = instr.globalStringPtr("fmt.jsnum", "JSV<number %d>");
    builder.CreateCall(
      snprintf,
      [
        strPtr.llValue,
        builder.getInt32(1000),
        builder.CreateInBoundsGEP(
          builder.getInt8PtrTy(),
          fmtNum.llValue,
          []
        ),
        unboxedNum.llValue
      ],
      'deb'
    );
    instr.ret(func, strPtr);
  
    instr.insertPoint(unkBlock);
    const fmtJsv = instr.globalStringPtr("fmt.jsv", "JSV<?>");
    instr.ret(func, fmtJsv);

    return func;
  })();

  return (value: Value<any>) => {
    const strPtr = instr.malloc('s', types.i8, types.i64.constValue(1000));
    if (value.type instanceof IntType) {
      const fmtInt = builder.CreateGlobalStringPtr("(i%d %d)", "fmt.int");
      builder.CreateCall(
        snprintf,
        [
          strPtr.llValue,
          builder.getInt32(1000),
          builder.CreateInBoundsGEP(
            builder.getInt8PtrTy(),
            fmtInt,
            []
          ),
          types.i32.constValue(value.type.bits).llValue,
          value.llValue
        ],
        'deb'
      );
      return strPtr;
    }

    if (value.type instanceof PointerType &&
        value.type.toType instanceof JsValueType) {
      const jsv = instr.cast('jsv', value, types.jsValue);
      return instr.call('jsv_deb', debugJsvFunc, {v: jsv});
    }

    const unk = builder.CreateGlobalStringPtr("(unknown)", "fmt.unk");
    return new Pointer(types.i8, unk);
  };
}

function printfFactory(builder: llvm.IRBuilder, snprintf: llvm.Function, puts: llvm.Function, debugValue: (value: Value<any>) => Pointer<I8Type>) {
  return (fmt: string, args: (Value<any>|llvm.Value)[]) => {
    const fmtPtr = builder.CreateGlobalStringPtr(fmt, "fmt");
    const strPtr = builder.CreateAlloca(
      builder.getInt8Ty(),
      builder.getInt32(1000),
      's'
    );
    builder.CreateCall(
      snprintf,
      [
        strPtr,
        builder.getInt32(1000),
        builder.CreateInBoundsGEP(
          builder.getInt8PtrTy(),
          fmtPtr,
          []
        ),
        ...args.map(v => v instanceof Value ? v.llValue : v),
      ],
      's'
    );
    builder.CreateCall(
      puts,
      [strPtr],
      'printf'
    );
  };
}

function snprintfFactory(builder: llvm.IRBuilder, module: llvm.Module) {
  // declare i32 @snprintf(i8*, i32, i8*, ...)  
  const functionType = llvm.FunctionType.get(
    builder.getInt32Ty(),
    [
      builder.getInt8PtrTy(),
      builder.getInt32Ty(),
      builder.getInt8PtrTy(),
    ],
    true);
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
    false);
  const func = llvm.Function.Create(
    functionType,
    llvm.Function.LinkageTypes.ExternalLinkage,
    "puts",
    module
  );
  return func;
}
