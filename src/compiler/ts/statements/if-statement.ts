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
