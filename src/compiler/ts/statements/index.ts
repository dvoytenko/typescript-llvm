import ts from "typescript";
import { CompilerContext } from "../../context";
import { Value } from "../../types/base";

export type StatementHandler<ST extends ts.Statement> = (st: ST) => void;

export type StatementHandlers = {
  [K in ts.SyntaxKind]?: StatementHandler<any>;
}

type StatementFactories = {
  [K in ts.SyntaxKind]?: (context: CompilerContext) => StatementHandler<any>;
}

export function statements(context: CompilerContext): StatementHandlers {
  const factories: StatementFactories = {
    [ts.SyntaxKind.Block]: blockFactory,
    [ts.SyntaxKind.ReturnStatement]: returnFactory,
    [ts.SyntaxKind.ExpressionStatement]: expressionFactory,
  };
  return Object.fromEntries(
    Object.entries(factories).map(
      ([kind, factory]) => [kind, factory(context)]
    )
  );
}

function blockFactory({genStatement}: CompilerContext) {
  return (node: ts.Block) => {
    node.statements.forEach(st => genStatement(st));
  };
}

function returnFactory({currentFunc, types, instr, genExpr}: CompilerContext) {
  return (node: ts.ReturnStatement) => {
    const func = currentFunc()!;
    const gFunc = func.func;
    if (func.name === 'main') {
      // QQQ: remove "main" specialization?
      instr.ret(gFunc, types.i32.constValue(0));
    } else if (node.expression) {
      const value = genExpr(node.expression);
      if (!(value instanceof Value<any>)) {
        throw new Error('cannot return value');
      }
      instr.ret(gFunc, value);
    } else {
      // TODO: CreateRetVoid
      // builder.CreateStore(builder.getInt32(0), retval!);
    }
  };
}

function expressionFactory({genExpr}: CompilerContext) {
  return (node: ts.ExpressionStatement) => {
    genExpr(node.expression);
  };
}
