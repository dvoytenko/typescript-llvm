import ts from "typescript";
import { CompilerContext } from "../../context";
import { tsToTypeUnboxed } from "../types";

export function identifierFactory(context: CompilerContext) {
  const { checker, declFunction, ref, instr } = context;
  return (node: ts.Identifier) => {
    const idName = node.text;
    const symbol = checker.getSymbolAtLocation(node);
    if (!symbol) {
      throw new Error(`no symbol for identifier ${idName}`);
    }
    const decl = symbol.valueDeclaration;
    if (!decl) {
      throw new Error(`no declaration for identifier ${idName}`);
    }

    if (ts.isFunctionDeclaration(decl)) {
      return declFunction(decl);
    }

    const value = ref(decl);
    const tsType = checker.getTypeOfSymbolAtLocation(symbol, node);
    const type = tsToTypeUnboxed(tsType, node, context);
    return instr.strictConvert(value, type);
  };
}
