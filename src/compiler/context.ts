import llvm from "llvm-bindings";
import ts from "typescript";
import { Debug } from "./debug";
import { Instr } from "./instr";
import { Jslib } from "./jslib";
import { TsFunction } from "./ts/func";
import { TsIfc, TsObj } from "./ts/obj";
import { Types } from "./types";
import { Value } from "./types/base";

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
  genStatement(node: ts.Statement);
  genExpr(node: ts.Expression): Value<any> | TsFunction | null;

  genInBlock(block: llvm.BasicBlock, gen: () => void, finish: () => void);
  terminateBlock();

  declObjType(tsType: ts.Type, node: ts.Node): TsObj;
  declIfc(tsType: ts.Type, node: ts.Node): TsIfc;
}
