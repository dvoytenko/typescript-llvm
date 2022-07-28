import llvm from 'llvm-bindings';
import { Types } from '../types';
import { BoxedType, I32Type, I64Type, I8Type, IntType, Pointer, PointerType, Type, Value } from '../types/base';
import { BoolType } from '../types/bool';
import { FunctionArgs, FunctionArgValues, FunctionType } from '../types/func';
import { Function } from './func';
import { GlobalVar } from './globalvar';

export interface Instr {
  builder: llvm.IRBuilder;
  globalConstVar: <T extends Type>(name: string, value: Value<T>) => GlobalVar<T>;
  globalStringPtr: (name: string, value: string) => Pointer<I8Type>;
  alloca: <T extends Type>(type: T, arraySize?: Value<I32Type> | null) => Pointer<T>;
  malloc: <T extends Type>(type: T, arraySize?: Value<I64Type> | null) => Pointer<T>;
  cast: <T extends Type>(ptr: Pointer<Type>, toType: T) => Pointer<T>;
  add: <T extends IntType<any>>(a: Value<T>, b: Value<T>) => Value<T>;
  icmpEq: <T extends IntType<any>>(a: Value<T>, b: Value<T>) => Value<BoolType>;
  // TODO: only primitives (first class, non-aggr)
  load: <T extends Type>(ptr: Pointer<T>) => Value<T>;
  loadUnboxed: <T extends Type & BoxedType<any>>(ptr: Pointer<T>) =>
      Value<T extends BoxedType<infer BT> ? BT : never>;
  // store: () => void;
  storeBoxed: <T extends Type & BoxedType<any>>(ptr: Pointer<T>, value: Value<T extends BoxedType<infer BT> ? BT : never>) => void;
  func: <Ret extends Type, Args extends FunctionArgs>(name: string, type: FunctionType<Ret, Args>) =>
      Function<Ret, Args>;
  block: (func: Function<any, any>, name: string) => llvm.BasicBlock;
  insertPoint: (block: llvm.BasicBlock) => void;
  // TODO: only primitives (first class, non-aggr)
  // TODO: pass func to check return type
  ret: <T extends Type>(func: Function<T, any>, value: Value<T>) => void;
  call: <Ret extends Type, Args extends FunctionArgs>(func: Function<Ret, Args>, args: FunctionArgValues<Args>) => Value<Ret>;
  // Branching.
  condBr: (cond: Value<BoolType>, trueBlock: llvm.BasicBlock, falseBlock: llvm.BasicBlock) => void;
  switchBr: <T extends IntType<any>>(cond: Value<T>, defBlock: llvm.BasicBlock, cases: SwitchCase<T>[]) => void;
}

export function instrFactory(context: llvm.LLVMContext, builder: llvm.IRBuilder, module: llvm.Module, types: Types): Instr {
  return {
    builder,
    globalConstVar: (name, value) => new GlobalVar(module, name, value),
    globalStringPtr: (name, value) => new Pointer(types.i8, builder.CreateGlobalStringPtr(value, name)),
    alloca: allocaFactory(builder),
    malloc: mallocFactory(builder, module),
    cast: castFactory(builder),
    add: addFactory(builder),
    icmpEq: icmpEqFactory(types, builder),
    load: loadFactory(builder),
    loadUnboxed: loadUnboxedFactory(builder),
    // store: storeFactory(builder),
    storeBoxed: storeBoxedFactory(builder),
    func: <Ret extends Type, Args extends FunctionArgs>(name: string, type: FunctionType<Ret, Args>) => new Function(module, name, type),
    block: (func: Function<any, any>, name: string) => llvm.BasicBlock.Create(context, name, func.llFunc),
    insertPoint: (block: llvm.BasicBlock) => builder.SetInsertPoint(block),
    ret: retFactory(builder),
    call: callFactory(builder),
    condBr: condBrFactory(builder),
    switchBr: switchBrFactory(builder),
  };
}

function allocaFactory(builder: llvm.IRBuilder) {
  return <T extends Type>(type: T, arraySize?: Value<I32Type> | null) => {
    const ptr = builder.CreateAlloca(type.llType, arraySize?.llValue);
    return new Pointer(type, ptr);
  };
}

function mallocFactory(builder: llvm.IRBuilder, module: llvm.Module) {
  // declare i8* @malloc(i64)
  const functionType = llvm.FunctionType.get(
    builder.getInt8PtrTy(),
    [builder.getInt64Ty()],
    false);
  const func = llvm.Function.Create(
    functionType,
    llvm.Function.LinkageTypes.ExternalLinkage,
    "malloc",
    module
  );
  return <T extends Type>(type: T, arraySize?: Value<I64Type> | null) => {
    const pointerType = PointerType.of(type);
    const size = type.sizeof(builder);
    const ptr = builder.CreateBitCast(
      builder.CreateCall(
        func,
        [arraySize?.llValue ?? size.llValue]
      ),
      pointerType.llType
    );
    return new Pointer(type, ptr);
  };
}

function castFactory(builder: llvm.IRBuilder) {
  return <T extends Type>(ptr: Pointer<Type>, toType: T) => {
    const castPtr = builder.CreateBitCast(
      ptr.llValue,
      PointerType.of(toType).llType
    );
    return new Pointer(toType, castPtr);
  };
}

function addFactory(builder: llvm.IRBuilder) {
  return <T extends IntType<any>>(a: Value<T>, b: Value<T>) => {
    const res = builder.CreateAdd(a.llValue, b.llValue);
    return new Value(a.type, res);
  };
}

function icmpEqFactory(types: Types, builder: llvm.IRBuilder) {
  return <T extends IntType<any>>(a: Value<T>, b: Value<T>) => {
    const res = builder.CreateICmpEQ(a.llValue, b.llValue);
    return new Value(types.bool, res);
  };
}

function loadFactory(builder: llvm.IRBuilder) {
  return <T extends Type>(ptr: Pointer<T>) => {
    // public CreateLoad(type: Type, ptr: Value, name?: string): LoadInst;
    const toType = ptr.type.toType;
    const res = builder.CreateLoad(
      toType.llType,
      ptr.llValue
    );
    return new Value(toType, res);
  };
}

function loadUnboxedFactory(builder: llvm.IRBuilder) {
  return <T extends Type & BoxedType<any>>(ptr: Pointer<T>) => {
    const toType = ptr.type.toType;
    return toType.loadUnboxed(builder, ptr);
  };
}

// function storeFactory(builder: llvm.IRBuilder) {
//   return <T extends Type>(ptr: Pointer<T>, value: Value<T>) => {
//     const toType = ptr.type.toType;
//     const res = builder.CreateLoad(
//       toType.llType,
//       ptr.llValue
//     );
//     return new Value(toType, res);
//   };
// }

function storeBoxedFactory(builder: llvm.IRBuilder) {
  return <T extends Type & BoxedType<any>>(ptr: Pointer<T>, value: Value<T extends BoxedType<infer BT> ? BT : never>) => {
    const toType = ptr.type.toType;
    toType.storeBoxed(builder, ptr, value);
  };
}

function retFactory(builder: llvm.IRBuilder) {
  return <T extends Type>(func: Function<T, any>, value: Value<T>) => {
    builder.CreateRet(value.llValue);
  };
}

function callFactory(builder: llvm.IRBuilder) {
  return <Ret extends Type, Args extends FunctionArgs>(func: Function<Ret, Args>, args: FunctionArgValues<Args>) => {
    const res = builder.CreateCall(func.llFunc, func.type.createArgValues(args).map(v => v.llValue));
    return new Value(func.type.retType, res);
  };
}

function condBrFactory(builder: llvm.IRBuilder) {
  return (cond: Value<BoolType>, trueBlock: llvm.BasicBlock, falseBlock: llvm.BasicBlock) => {
    builder.CreateCondBr(cond.llValue, trueBlock, falseBlock);
  };
}

interface SwitchCase<T extends IntType<any>> {
  on: Value<T>;
  block: llvm.BasicBlock;
}

function switchBrFactory(builder: llvm.IRBuilder) {
  // switch i32 %val, label %otherwise [ i32 0, label %onzero
  //   i32 1, label %onone
  //   i32 2, label %ontwo ]
  return <T extends IntType<any>>(cond: Value<T>, defBlock: llvm.BasicBlock, cases: SwitchCase<T>[]) => {
    // public CreateSwitch(value: Value, dest: BasicBlock, numCases?: number): SwitchInst;
    const st = builder.CreateSwitch(cond.llValue, defBlock, cases.length);
    // public addCase(onVal: ConstantInt, dest: BasicBlock): void;
    for (const c of cases) {
      // QQQ: remove cast to ConstantInt
      st.addCase(c.on.llValue as llvm.ConstantInt, c.block);
    }
  };
}
