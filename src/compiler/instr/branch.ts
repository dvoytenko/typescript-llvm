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
import { BoolType, ConstValue, IntType, Type, Value } from "../types";
import { getName } from "./name";

export type BrType = (dest: llvm.BasicBlock) => void;

export type CondBrType = (
  cond: Value<BoolType>,
  trueBlock: llvm.BasicBlock,
  falseBlock: llvm.BasicBlock
) => void;

export type SwitchBrType = <T extends IntType<any>>(
  cond: Value<T>,
  defBlock: llvm.BasicBlock,
  cases: SwitchCase<T>[]
) => void;

export type PhiBrType = <T extends IntType<any>>(
  name: string,
  type: T,
  branchCount: number
) => PhiBr<T>;

export function brFactory(builder: llvm.IRBuilder) {
  return (dest: llvm.BasicBlock) => {
    builder.CreateBr(dest);
  };
}

export function condBrFactory(builder: llvm.IRBuilder) {
  return (
    cond: Value<BoolType>,
    trueBlock: llvm.BasicBlock,
    falseBlock: llvm.BasicBlock
  ) => {
    builder.CreateCondBr(cond.llValue, trueBlock, falseBlock);
  };
}

export interface PhiBr<T extends Type> {
  value: Value<T>;
  addIncoming(value: Value<T>, block: llvm.BasicBlock);
}

export function phiBrFactory(builder: llvm.IRBuilder) {
  return <T extends IntType<any>>(
    name: string,
    type: T,
    branchCount: number
  ): PhiBr<T> => {
    const phi = builder.CreatePHI(type.llType, branchCount, getName(name));
    return {
      value: new Value(type, phi),
      addIncoming(value: Value<T>, block: llvm.BasicBlock) {
        phi.addIncoming(value.llValue, block);
      },
    };
  };
}

export interface SwitchCase<T extends IntType<any>> {
  on: ConstValue<T>;
  block: llvm.BasicBlock;
}

export function switchBrFactory(builder: llvm.IRBuilder) {
  // switch i32 %val, label %otherwise [ i32 0, label %onzero
  //   i32 1, label %onone
  //   i32 2, label %ontwo ]
  return <T extends IntType<any>>(
    cond: Value<T>,
    defBlock: llvm.BasicBlock,
    cases: SwitchCase<T>[]
  ) => {
    const st = builder.CreateSwitch(cond.llValue, defBlock, cases.length);
    for (const c of cases) {
      st.addCase(c.on.llValue, c.block);
    }
  };
}
