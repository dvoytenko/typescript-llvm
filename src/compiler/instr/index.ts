/*
Copyright 2022 Google LLC

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    https://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import llvm from "llvm-bindings";
import { Types } from "../types";
import { ConstValue, Pointer, PrimitiveType, Type, Value } from "../types";
import { I8Type } from "../types/inttype";
import { BoolType } from "../types/bool";
import { FunctionType } from "../types/func";
import {
  callFactory,
  CallType,
  callVoidFactory,
  CallVoidType,
  Function,
  retFactory,
  RetType,
} from "./func";
import { Globals } from "./globals";
import { GlobalVar } from "./globalvar";
import { allocaFactory, AllocaType } from "./alloca";
import { mallocFactory, MallocType } from "./malloc";
import { sizeofFactory, SizeofType } from "./sizeof";
import { strictConvertFactory, StrictConvertType } from "./strict-convert";
import { castPtrFactory, CastPtrType } from "./cast";
import {
  loadFactory,
  LoadType,
  loadUnboxedFactory,
  LoadUnboxedType,
  storeBoxedFactory,
  StoreBoxedType,
  storeFactory,
  StoreType,
} from "./load-store";
import {
  gepStructFieldFactory,
  GepStructFieldType,
  loadStructFieldFactory,
  LoadStructFieldType,
} from "./struct";
import {
  brFactory,
  BrType,
  condBrFactory,
  CondBrType,
  phiBrFactory,
  PhiBrType,
  switchBrFactory,
  SwitchBrType,
} from "./branch";
import { gepArrayFactory, GepArrayType } from "./array";
import {
  addFactory,
  AddType,
  icmpEqFactory,
  IcmpEqType,
  subFactory,
  SubType,
} from "./arithm";

export interface InstrValues {}

export interface Instr {
  builder: llvm.IRBuilder;
  types: Types;
  values: InstrValues;
  globalConstVar: <T extends Type>(
    name: string,
    value: ConstValue<T>
  ) => GlobalVar<T>;
  globalStringPtr: (value: string) => Pointer<I8Type>;
  alloca: AllocaType;
  malloc: MallocType;
  sizeof: SizeofType;
  gepStructField: GepStructFieldType;
  gepArray: GepArrayType;
  castPtr: CastPtrType;
  strictConvert: StrictConvertType;
  add: AddType;
  sub: SubType;
  icmpEq: IcmpEqType;
  isNull: (value: Pointer) => Value<BoolType>;
  load: LoadType;
  store: StoreType;
  loadUnboxed: LoadUnboxedType;
  storeBoxed: StoreBoxedType;
  loadStructField: LoadStructFieldType;
  func: <Ret extends PrimitiveType, Args extends [...PrimitiveType[]]>(
    name: string,
    type: FunctionType<Ret, Args>,
    attrs?: string[]
  ) => Function<Ret, Args>;
  block: (func: Function<any, any>, name: string) => llvm.BasicBlock;
  insertPoint: (block: llvm.BasicBlock) => void;
  ret: RetType;
  call: CallType;
  callVoid: CallVoidType;
  // Branching.
  br: BrType;
  condBr: CondBrType;
  switchBr: SwitchBrType;
  phiBr: PhiBrType;
}

export function instrFactory(
  context: llvm.LLVMContext,
  builder: llvm.IRBuilder,
  module: llvm.Module,
  types: Types
): Instr {
  const values: InstrValues = {};
  const sizeof = sizeofFactory(builder, types);
  const malloc = mallocFactory(builder, module, sizeof);
  const globalStrings = new Globals<llvm.Constant, [string]>((name, value) =>
    builder.CreateGlobalStringPtr(value, name)
  );
  const load = loadFactory(builder);
  const gepStructField = gepStructFieldFactory(builder);
  return {
    builder,
    types,
    values,
    globalConstVar: (name, value) => new GlobalVar(module, name, value),
    globalStringPtr: (value) =>
      new Pointer(types.i8, globalStrings.get(`s.${value || "empty"}`, value)),
    alloca: allocaFactory(builder),
    malloc,
    sizeof,
    gepStructField,
    gepArray: gepArrayFactory(builder),
    castPtr: castPtrFactory(builder),
    strictConvert: strictConvertFactory(builder, types, malloc),
    add: addFactory(builder),
    sub: subFactory(builder),
    icmpEq: icmpEqFactory(types, builder),
    isNull: isNullFactory(types, builder),
    load,
    store: storeFactory(builder),
    loadUnboxed: loadUnboxedFactory(builder),
    storeBoxed: storeBoxedFactory(builder),
    loadStructField: loadStructFieldFactory(builder, gepStructField, load),
    func: <Ret extends Type, Args extends [...Type[]]>(
      name: string,
      type: FunctionType<Ret, Args>,
      attrs?: string[]
    ) => new Function(module, name, type, attrs),
    block: (func: Function<any, any>, name: string) =>
      llvm.BasicBlock.Create(context, name, func.llFunc),
    insertPoint: (block: llvm.BasicBlock) => builder.SetInsertPoint(block),
    ret: retFactory(builder),
    call: callFactory(builder),
    callVoid: callVoidFactory(builder),
    br: brFactory(builder),
    condBr: condBrFactory(builder),
    switchBr: switchBrFactory(builder),
    phiBr: phiBrFactory(builder),
  };
}

function isNullFactory(types: Types, builder: llvm.IRBuilder) {
  return (value: Pointer) => {
    const res = builder.CreateIsNull(value.llValue);
    return new Value(types.bool, res);
  };
}
