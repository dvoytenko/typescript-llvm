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
