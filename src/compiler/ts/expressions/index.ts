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
import { Value } from "../../types/base";
import { TsFunction } from "../func";
import { binaryExpressionFactory } from "./binary";
import { callFactory } from "./call";
import { identifierFactory } from "./identifier";
import { jsxExprFactories } from "./jsx";
import { numericLiteralFactory } from "./numeric-literal";
import { objectLiteralExpressionFactory } from "./object-literal";
import { propertyAccessExpressionFactory } from "./property-access";

export type ExprHandler<E extends ts.Expression> = (
  st: E
) => Value | TsFunction | null;

export type ExprHandlers = {
  [K in ts.SyntaxKind]?: ExprHandler<any>;
};

export type ExprFactories = {
  [K in ts.SyntaxKind]?: (context: CompilerContext) => ExprHandler<any>;
};

export function expressions(context: CompilerContext): ExprHandlers {
  const factories: ExprFactories = {
    [ts.SyntaxKind.ParenthesizedExpression]: parenthesizedExpressionFactory,
    [ts.SyntaxKind.CallExpression]: callFactory,
    [ts.SyntaxKind.Identifier]: identifierFactory,
    [ts.SyntaxKind.NullKeyword]: nullFactory,
    [ts.SyntaxKind.NumericLiteral]: numericLiteralFactory,
    [ts.SyntaxKind.BinaryExpression]: binaryExpressionFactory,
    [ts.SyntaxKind.ObjectLiteralExpression]: objectLiteralExpressionFactory,
    [ts.SyntaxKind.PropertyAccessExpression]: propertyAccessExpressionFactory,
    ...jsxExprFactories,
  };
  return Object.fromEntries(
    Object.entries(factories).map(([kind, factory]) => [kind, factory(context)])
  );
}

function parenthesizedExpressionFactory(context: CompilerContext) {
  const { genExpr } = context;
  return (node: ts.ParenthesizedExpression) => {
    return genExpr(node.expression);
  };
}

function nullFactory({ jslib }: CompilerContext) {
  return () => {
    return jslib.values.jsNull;
  };
}
