import ts from "typescript";
import { Debug } from "./debug";
import { Instr } from "./instr";
import { Jslib } from "./jslib";
import { TsFunction } from "./ts/func";
import { Types } from "./types";
import { Value } from "./types/base";

export interface CompilerContext {

  types: Types;
  instr: Instr;
  debug: Debug;
  jslib: Jslib;

  checker: ts.TypeChecker;

  currentFunc(): TsFunction|null;
  ref(node: ts.Node): Value<any>;

  declFunction(node: ts.FunctionDeclaration): TsFunction;
  genStatement(node: ts.Statement);
  genExpr(node: ts.Expression): Value<any>|TsFunction|null;
}
