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
