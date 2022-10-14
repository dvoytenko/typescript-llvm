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
import { ifFactory } from "./if-statement";
import { returnFactory } from "./return-statement";

export type StatementHandler<ST extends ts.Statement> = (st: ST) => void;

export type StatementHandlers = {
  [K in ts.SyntaxKind]?: StatementHandler<any>;
};

type StatementFactories = {
  [K in ts.SyntaxKind]?: (context: CompilerContext) => StatementHandler<any>;
};

export function statements(context: CompilerContext): StatementHandlers {
  const factories: StatementFactories = {
    [ts.SyntaxKind.Block]: blockFactory,
    [ts.SyntaxKind.ReturnStatement]: returnFactory,
    [ts.SyntaxKind.ExpressionStatement]: expressionFactory,
    [ts.SyntaxKind.IfStatement]: ifFactory,
  };
  return Object.fromEntries(
    Object.entries(factories).map(([kind, factory]) => [kind, factory(context)])
  );
}

function blockFactory({ genStatement }: CompilerContext) {
  return (node: ts.Block) => {
    node.statements.forEach((st) => genStatement(st));
  };
}

function expressionFactory({ genExpr }: CompilerContext) {
  return (node: ts.ExpressionStatement) => {
    genExpr(node.expression);
  };
}
