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
  ref(node: ts.Node): Value<any>;

  declFunction(node: ts.FunctionDeclaration): TsFunction;
  getFunction(name: string): TsFunction | null;
  genStatement(node: ts.Statement);
  genExpr(node: ts.Expression): Value<any> | TsFunction | null;

  genInBlock(block: llvm.BasicBlock, gen: () => void, finish: () => void);
  terminateBlock();

  declObjType(name: string, shape: StructFields): TsObj;
  declIfc(name: string, shape: StructFields): TsIfc;
}
