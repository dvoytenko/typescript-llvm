import ts from "typescript";
import { CompilerContext } from "../../context";

export function numericLiteralFactory(context: CompilerContext) {
  const { types } = context;
  return (node: ts.NumericLiteral) => {
    // TODO: type (llvm.ConstantFP.get(builder.getFloatTy(), 1.4))
    const num = types.i32.constValue(parseInt(node.text, 10));
    return num;
  };
}
