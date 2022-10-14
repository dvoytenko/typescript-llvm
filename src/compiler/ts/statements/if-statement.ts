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
import { CompilerContext } from "../../context";
import { Value } from "../../types";

export function ifFactory({
  currentFunc,
  instr,
  types,
  genExpr,
  genStatement,
  genInBlock,
}: CompilerContext) {
  return (node: ts.IfStatement) => {
    const func = currentFunc()!;
    const gFunc = func.func;

    const value = genExpr(node.expression);
    if (!(value instanceof Value) || !value.isA(types.bool)) {
      throw new Error("cannot use this value for branching");
    }

    const trueBlock = instr.block(gFunc, "then");
    const falseBlock = node.elseStatement ? instr.block(gFunc, "else") : null;
    const contBlock = instr.block(gFunc, "cont");
    instr.condBr(value, trueBlock, falseBlock ?? contBlock);

    // then:
    genInBlock(
      trueBlock,
      () => genStatement(node.thenStatement),
      () => instr.br(contBlock)
    );

    // else:
    if (falseBlock) {
      genInBlock(
        falseBlock,
        () => genStatement(node.elseStatement!),
        () => instr.br(contBlock)
      );
    }

    // cont:
    instr.insertPoint(contBlock);
  };
}
