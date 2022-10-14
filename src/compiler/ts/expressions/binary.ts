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

export function binaryExpressionFactory({ jslib, genExpr }: CompilerContext) {
  return (node: ts.BinaryExpression) => {
    const left = genExpr(node.left);
    const right = genExpr(node.right);
    if (!(left instanceof Value)) {
      throw new Error("cannot use value for binary expression");
    }
    if (!(right instanceof Value)) {
      throw new Error("cannot use value for binary expression");
    }
    const op = node.operatorToken;
    if (op.kind === ts.SyntaxKind.PlusToken) {
      // TODO: better name: var name, etc?
      return jslib.add("add_res", left, right);
    }
    if (op.kind === ts.SyntaxKind.MinusToken) {
      return jslib.sub("sub_res", left, right);
    }
    if (op.kind === ts.SyntaxKind.EqualsEqualsEqualsToken) {
      return jslib.strictEq("stricteq", left, right);
    }
    throw new Error(
      `unknown binary operator: ${ts.SyntaxKind[op.kind]} (${op.getText()})`
    );
  };
}
