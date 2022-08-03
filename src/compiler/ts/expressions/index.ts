import ts from "typescript";
import { CompilerContext } from "../../context";
import { PointerType, Type, Value } from "../../types/base";
import { JsCustObject } from "../../types/jsobject";
import { TsFunction } from "../func";
import { tsToGType, tsToGTypeUnboxed } from "../types";

export type ExprHandler<E extends ts.Expression> = (
  st: E
) => Value<any> | TsFunction | null;

export type ExprHandlers = {
  [K in ts.SyntaxKind]?: ExprHandler<any>;
};

type ExprFactories = {
  [K in ts.SyntaxKind]?: (context: CompilerContext) => ExprHandler<any>;
};

export function expressions(context: CompilerContext): ExprHandlers {
  const factories: ExprFactories = {
    [ts.SyntaxKind.CallExpression]: callFactory,
    [ts.SyntaxKind.Identifier]: identifierFactory,
    [ts.SyntaxKind.NullKeyword]: nullFactory,
    [ts.SyntaxKind.NumericLiteral]: numericLiteralFactory,
    [ts.SyntaxKind.BinaryExpression]: binaryExpressionFactory,
    [ts.SyntaxKind.ObjectLiteralExpression]: objectLiteralExpressionFactory,
    [ts.SyntaxKind.PropertyAccessExpression]: propertyAccessExpressionFactory,
  };
  return Object.fromEntries(
    Object.entries(factories).map(([kind, factory]) => [kind, factory(context)])
  );
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
        if (!(value instanceof Value<any>)) {
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
  const args: Value<any>[] = [];
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
    if (!(left instanceof Value<any>)) {
      throw new Error("cannot use value for binary expression");
    }
    if (!(right instanceof Value<any>)) {
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
  const { types, instr, jslib, checker, genExpr } = context;
  return (node: ts.ObjectLiteralExpression) => {
    const tsType = checker.getTypeAtLocation(node);
    console.log("QQQ: obj type: ", checker.typeToString(tsType));
    const jsType = (
      tsToGType(tsType, node, context) as PointerType<JsCustObject>
    ).toType;
    console.log("QQQ: obj gtype: ", jsType);

    // TODO: better name from source.
    const ptr = jslib.jsObject.create(jsType);
    const custPtr = jsType.gep(instr.builder, ptr, "cust");
    for (const prop of node.properties) {
      const propAssignment = prop as ts.PropertyAssignment;
      if (!ts.isIdentifier(propAssignment.name)) {
        throw new Error("only identifiers supported as object keys");
      }
      const propValue = genExpr(propAssignment.initializer);
      if (!(propValue instanceof Value<any>)) {
        throw new Error("cannot use value for object expression");
      }

      const propName = propAssignment.name.text;

      // QQQ: debug map vs struct access
      if (jsType.cust?.fieldNames.includes(propName)) {
        const propValueType = custPtr.type.toType.fields[propName] as Type;
        const propValueConv = instr.strictConvert(propValue, propValueType);
        jsType.cust.store(instr.builder, custPtr, propName, propValueConv);
      } else {
        const keyStr = types.jsString.constValue(instr, propName);
        const keyPtr = instr.globalConstVar("jss", keyStr).ptr;
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
  const { types, instr, jslib, checker, genExpr } = context;
  return (node: ts.PropertyAccessExpression) => {
    const target = genExpr(node.expression);
    if (!(target instanceof Value<any>)) {
      throw new Error("cannot use value for object access expression");
    }

    const propName = node.name.text;
    const symbol = checker.getSymbolAtLocation(node.name);
    if (symbol) {
      const decl = symbol.valueDeclaration!;
      const declType = checker.getTypeAtLocation(decl.parent);
      console.log("QQQ: prop access type: ", checker.typeToString(declType));
      const jsType = (
        tsToGType(declType, node, context) as PointerType<JsCustObject>
      ).toType;
      console.log("QQQ: prop access gtype: ", jsType);

      if (jsType.cust?.fieldNames.includes(propName)) {
        const objPtr = instr.strictConvert(target, jsType.pointerOf());
        const custPtr = jsType.gep(instr.builder, objPtr, "cust");
        return jsType.cust.load(instr.builder, custPtr, propName);
      }
    }

    // Fallback to map read.
    const keyStr = types.jsString.constValue(instr, propName);
    const keyPtr = instr.globalConstVar("jss", keyStr).ptr;
    return jslib.jsObject.getField(target, keyPtr);
  };
}
