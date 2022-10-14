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

import ts from "typescript";
import { CompilerContext } from "../context";
import { Instr } from "../instr";
import { Function } from "../instr/func";
import { Types } from "../types";
import { tsToTypeUnboxed } from "./types";

export class TsFunction {
  public generated = false;

  constructor(
    public readonly node: ts.FunctionDeclaration,
    public readonly func: Function<any, any>
  ) {}

  get name() {
    return this.func.name;
  }
}

export function declFunction(
  node: ts.FunctionDeclaration,
  context: CompilerContext
): Function<any, any> {
  const { checker, types, instr } = context;
  const funcName = node.name!.text;

  if (funcName === "main") {
    return declMainFunction(node, types, instr);
  }

  const sig = checker.getSignatureFromDeclaration(node)!;
  const tsReturnType = checker.getReturnTypeOfSignature(sig);
  // console.log("QQQ: sig: ", checker.signatureToString(sig));
  // console.log("QQQ: ret: ", checker.typeToString(tsReturnType));
  const returnType = tsToTypeUnboxed(tsReturnType, node, context);
  // console.log("QQQ: llReturnType: ", returnType);

  const args = node.parameters.map((arg) => {
    // const argName = arg.name.getText();
    const argTsType = checker.getTypeAtLocation(arg);
    return tsToTypeUnboxed(argTsType, arg, context);
  });

  const funcType = types.func(returnType, args);
  const func = instr.func(`u/${funcName}`, funcType);
  return func;
}

function declMainFunction(
  node: ts.FunctionDeclaration,
  types: Types,
  instr: Instr
) {
  const funcType = types.func(types.i32, []);
  const func = instr.func("main", funcType);
  return func;
}
