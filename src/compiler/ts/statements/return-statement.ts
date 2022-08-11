import ts from "typescript";
import { CompilerContext } from "../../context";
import { Value } from "../../types";

export function returnFactory({
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
