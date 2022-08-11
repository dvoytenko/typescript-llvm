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
