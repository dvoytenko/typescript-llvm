import ts from "typescript";
import { CompilerContext } from "../../context";
import { Value } from "../../types/base";

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

function returnFactory({
  currentFunc,
  types,
  instr,
  genExpr,
  terminateBlock,
}: CompilerContext) {
  return (node: ts.ReturnStatement) => {
    const func = currentFunc()!;
    const gFunc = func.func;
    if (func.name === "main") {
      // QQQ: remove "main" specialization?
      instr.ret(gFunc, types.i32.constValue(0));
    } else if (node.expression) {
      const value = genExpr(node.expression);
      if (!(value instanceof Value)) {
        throw new Error("cannot return value");
      }
      const retType = gFunc.type.retType;
      instr.ret(gFunc, instr.strictConvert(value, retType));
    } else {
      // TODO: CreateRetVoid
      // builder.CreateStore(builder.getInt32(0), retval!);
    }
    terminateBlock();
  };
}

function expressionFactory({ genExpr }: CompilerContext) {
  return (node: ts.ExpressionStatement) => {
    genExpr(node.expression);
  };
}

function ifFactory({
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
