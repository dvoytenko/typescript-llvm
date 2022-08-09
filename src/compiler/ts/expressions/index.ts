import ts from "typescript";
import { CompilerContext } from "../../context";
import { Pointer, Type, Value } from "../../types/base";
import { TsFunction } from "../func";
import { tsToGTypeUnboxed, tsToStructFields } from "../types";
import { jsxExprFactories } from "./jsx";

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

function callFactory(context: CompilerContext) {
  const { instr, genExpr } = context;
  return (node: ts.CallExpression) => {
    const expr = node.expression;

    // console.log pragma
    if (
      ts.isPropertyAccessExpression(expr) &&
      ts.isIdentifier(expr.expression) &&
      expr.expression.text === "console" &&
      expr.name.text === "log"
    ) {
      consoleLog(context, node);
      return null;
    }

    const funcRef = genExpr(expr);
    if (!funcRef) {
      throw new Error(`Function not found`);
    }

    if (funcRef instanceof TsFunction) {
      const { func } = funcRef;
      const args = func.type.args.map((type, index) => {
        const arg = node.arguments[index];
        const value = arg ? genExpr(arg) : null;
        if (!(value instanceof Value)) {
          throw new Error("cannot use the arg");
        }
        return instr.strictConvert(value, type);
      });
      return instr.call(`${func.name}_res`, func, args);
    }

    throw new Error(`Function cannot be called yet`);
  };
}

function consoleLog(context: CompilerContext, node: ts.CallExpression) {
  const { debug, genExpr } = context;
  let fmt = "";
  const args: Value[] = [];
  for (const arg of node.arguments) {
    if (fmt.length > 0) {
      fmt += " ";
    }
    if (ts.isStringLiteral(arg)) {
      fmt += arg.text;
    } else {
      // TODO: extract type from the signature and use
      // correct mask.
      const value = genExpr(arg);
      if (value == null) {
        fmt += "null";
      } else if (value instanceof TsFunction) {
        fmt += `<function ${value.name}>`;
      } else {
        fmt += "%s";
        args.push(debug.debugValue(value));
      }
    }
  }

  debug.printf(fmt, args);
}

function identifierFactory(context: CompilerContext) {
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
    const gType = tsToGTypeUnboxed(tsType, node, context);
    return instr.strictConvert(value, gType);
  };
}

function nullFactory({ jslib }: CompilerContext) {
  return () => {
    return jslib.values.jsNull;
  };
}

function numericLiteralFactory(context: CompilerContext) {
  const { types } = context;
  return (node: ts.NumericLiteral) => {
    // TODO: type (llvm.ConstantFP.get(builder.getFloatTy(), 1.4))
    const num = types.i32.constValue(parseInt(node.text, 10));
    return num;
  };
}

function binaryExpressionFactory({ jslib, genExpr }: CompilerContext) {
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

function objectLiteralExpressionFactory(context: CompilerContext) {
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

      // QQQ: debug map vs struct access
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

function propertyAccessExpressionFactory(context: CompilerContext) {
  const { types, instr, jslib, checker, genExpr, declIfc } = context;
  const { i32, i64, jsObject, vtableIfcField } = types;
  const { builder } = instr;
  return (node: ts.PropertyAccessExpression) => {
    const target = genExpr(node.expression);
    if (!(target instanceof Value) || !target.isPointer()) {
      throw new Error("cannot use value for object access expression");
    }

    const targetPtr = instr.castPtr("cast_to_jsobj", target, jsObject);
    const propName = node.name.text;
    const symbol = checker.getSymbolAtLocation(node.name);
    if (symbol) {
      const valueType = tsToGTypeUnboxed(
        checker.getTypeOfSymbolAtLocation(symbol, node),
        node,
        context
      );
      let value: Value | null = null;
      if (symbol.declarations && symbol.declarations.length > 0) {
        if (symbol.declarations.length === 1) {
          const decl = symbol.declarations[0]!;
          const declType = checker.getTypeAtLocation(decl.parent);

          const ifc = declIfc(
            checker.typeToString(declType),
            tsToStructFields(declType, node, context)
          );
          // QQQ: alternative:
          // - jsObject_getStructInt(ptr, ifc, index)
          // - jsObject_getStructBool(ptr, ifc, index)
          // - jsObject_getStructJsv(ptr, ifc, index)
          // However, how much of `ifc` lookup can we reuse between calls?
          if (propName in ifc.shape) {
            const propIndex = Object.keys(ifc.shape).indexOf(propName);
            const propType = ifc.shape[propName]!;

            const retval = instr.alloca("val", propType);
            const valBlock = instr.block(context.currentFunc()!.func, "val");

            const autoId = types.vtable.fields.itable.load(
              builder,
              instr.gepStructField(
                jsObject.load(builder, targetPtr, "vtable"),
                "itable"
              ),
              "autoId"
            );

            const isAuto = instr.icmpEq(
              "is_auto",
              autoId,
              i32.constValue(ifc.id)
            );

            const autoBlock = instr.block(context.currentFunc()!.func, "auto");
            const nonAutoBlock = instr.block(
              context.currentFunc()!.func,
              "non_auto"
            );
            instr.condBr(isAuto, autoBlock, nonAutoBlock);

            instr.insertPoint(autoBlock);
            const objPtr = instr.castPtr(
              "obj_ptr",
              targetPtr,
              jslib.values.jsEmptyObject
            );
            const custPtr = instr.gepStructField(objPtr, "cust");
            const ifcPtr = instr.castPtr("ifc_ptr", custPtr, ifc.shapeType);
            const autoVal = ifc.shapeType.load(builder, ifcPtr, propName);
            instr.store(retval, autoVal);

            instr.br(valBlock);

            instr.insertPoint(nonAutoBlock);
            const fieldsPtr = jslib.jsObject.getIfc(
              targetPtr,
              i32.constValue(ifc.id)
            );

            const isIfcNull = instr.isNull(fieldsPtr);
            const noIfcBlock = instr.block(
              context.currentFunc()!.func,
              "no_ifc"
            );
            const ifcBlock = instr.block(context.currentFunc()!.func, "ifc");
            instr.condBr(isIfcNull, noIfcBlock, ifcBlock);

            instr.insertPoint(ifcBlock);

            const fieldPtr = instr.gepArray(
              "field_ptr",
              fieldsPtr,
              i32.constValue(propIndex)
            );
            const offset = vtableIfcField.load(builder, fieldPtr, "offset");

            const targetPtrAsInt = builder.CreatePtrToInt(
              targetPtr.llValue,
              i64.llType
            );
            const jsObjectSize = instr.sizeof(jsObject);
            const offset64 = builder.CreateIntCast(
              offset.llValue,
              i64.llType,
              true
            );

            const offsetPtrInt = builder.CreateAdd(
              builder.CreateAdd(targetPtrAsInt, jsObjectSize.llValue),
              offset64
            );
            const offsetPtr = builder.CreateIntToPtr(
              offsetPtrInt,
              propType.pointerOf().llType
            );

            const ifcValue = instr.load(
              "ifc_val",
              new Pointer(propType, offsetPtr)
            );
            instr.store(retval, ifcValue);
            instr.br(valBlock);

            // Fallback to field search.
            instr.insertPoint(noIfcBlock);
            const keyPtr = jslib.jsString.globalConstVar(propName).ptr;
            const boxedValue = jslib.jsObject.getField(targetPtr, keyPtr);
            const unboxedValue = instr.strictConvert(boxedValue, valueType);
            instr.store(retval, unboxedValue);
            instr.br(valBlock);

            instr.insertPoint(valBlock);
            value = instr.load("val", retval);
          }
        } else {
          throw new Error("Multiple interfaces yet supported!");
        }
        return value;
      }
    }

    // Fallback to map read.
    const keyPtr = jslib.jsString.globalConstVar(propName).ptr;
    return jslib.jsObject.getField(targetPtr, keyPtr);
  };
}
