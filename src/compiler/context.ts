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
import ts from "typescript";
import { Debug } from "./debug";
import { Instr } from "./instr";
import { Jslib } from "./jslib";
import { TsFunction } from "./ts/func";
import { TsIfc, TsObj } from "./ts/obj";
import { Types } from "./types";
import { Value } from "./types/base";
import { StructFields } from "./types/struct";

export interface CompilerContext {
  module: llvm.Module;
  types: Types;
  instr: Instr;
  debug: Debug;
  jslib: Jslib;

  checker: ts.TypeChecker;

  currentFunc(): TsFunction | null;
  ref(node: ts.Node): Value;

  declFunction(node: ts.FunctionDeclaration): TsFunction;
  getFunction(name: string): TsFunction | null;
  genStatement(node: ts.Statement);
  genExpr(node: ts.Expression): Value | TsFunction | null;

  genInBlock(block: llvm.BasicBlock, gen: () => void, finish: () => void);
  terminateBlock();

  declObjType(name: string, shape: StructFields): TsObj;
  declIfc(name: string, shape: StructFields): TsIfc;
}
