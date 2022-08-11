import ts from "typescript";
import { CompilerContext } from "../../context";
import { Type, Value } from "../../types";
import { tsToStructFields } from "../types";

export function objectLiteralExpressionFactory(context: CompilerContext) {
  const { types, instr, jslib, checker, genExpr, declObjType } = context;
  return (node: ts.ObjectLiteralExpression) => {
    const tsType = checker.getTypeAtLocation(node);
    const tsObj = declObjType(
      checker.typeToString(tsType),
      tsToStructFields(tsType, node, context)
    );
    const jsType = tsObj.type;

    // TODO: better name from source.
    const ptr = jslib.jsObject.create(jsType);
    // const custPtr = jsType.gep(instr.builder, ptr, "cust");
    const custPtr = instr.gepStructField(ptr, "cust");
    for (const prop of node.properties) {
      // QQQ: support shorthand properties as well.
      const propAssignment = prop as ts.PropertyAssignment;
      if (!ts.isIdentifier(propAssignment.name)) {
        throw new Error("only identifiers supported as object keys");
      }
      if (!propAssignment.initializer) {
        throw new Error(
          `no prop initializer for ${propAssignment.name.text} in ${
            ts.SyntaxKind[prop.kind]
          }`
        );
      }
      const propValue = genExpr(propAssignment.initializer);
      if (!(propValue instanceof Value)) {
        throw new Error("cannot use value for object expression");
      }

      const propName = propAssignment.name.text;

      if (jsType.cust?.fieldNames.includes(propName)) {
        const propValueType = custPtr.type.toType.fields[propName] as Type;
        const propValueConv = instr.strictConvert(propValue, propValueType);
        jsType.cust.store(instr.builder, custPtr, propName, propValueConv);
      } else {
        const keyPtr = jslib.jsString.globalConstVar(propName).ptr;
        const propValuePtr = instr.strictConvert(
          propValue,
          types.jsValue.pointerOf()
        );
        jslib.jsObject.setField(ptr, keyPtr, propValuePtr);
      }
    }
    return ptr;
  };
}
