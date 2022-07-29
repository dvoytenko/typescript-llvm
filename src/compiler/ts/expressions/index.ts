import ts from "typescript";
import { CompilerContext } from "../../context";
import { Type, Value } from "../../types/base";
import { TsFunction } from "../func";
import { tsToGTypeUnboxed } from "../types";

export type ExprHandler<E extends ts.Expression> = (st: E) => Value<any>|TsFunction|null;

export type ExprHandlers = {
  [K in ts.SyntaxKind]?: ExprHandler<any>;
}

type ExprFactories = {
  [K in ts.SyntaxKind]?: (context: CompilerContext) => ExprHandler<any>;
}

export function expressions(context: CompilerContext): ExprHandlers {
  const factories: ExprFactories = {
    [ts.SyntaxKind.CallExpression]: callFactory,
    [ts.SyntaxKind.Identifier]: identifierFactory,
    [ts.SyntaxKind.NullKeyword]: nullFactory,
    [ts.SyntaxKind.NumericLiteral]: numericLiteralFactory,
    [ts.SyntaxKind.BinaryExpression]: binaryExpressionFactory,
  };
  return Object.fromEntries(
    Object.entries(factories).map(
      ([kind, factory]) => [kind, factory(context)]
    )
  );
}

function callFactory(context: CompilerContext) {
  const {instr, genExpr} = context;
  return (node: ts.CallExpression) => {
    const expr = node.expression;

    // console.log pragma
    if (ts.isPropertyAccessExpression(expr) &&
      ts.isIdentifier(expr.expression) &&
      expr.expression.text === 'console' &&
      expr.name.text === 'log') {
      consoleLog(context, node);
      return null;
    }

    const funcRef = genExpr(expr);
    if (!funcRef) {
      throw new Error(`Function not found`);
    }

    if (funcRef instanceof TsFunction) {
      const {func} = funcRef;
      const args = func.type.args.map((type, index) => {
        const arg = node.arguments[index];
        const value = arg ? genExpr(arg) : null;
        if (!(value instanceof Value<any>)) {
          throw new Error('cannot use the arg');
        }
        return instr.strictConvert(value, type);
      });
      return instr.call(`${func.name}_res`, func, args);
    }

    throw new Error(`Function cannot be called yet`);
  };
}

function consoleLog(context: CompilerContext, node: ts.CallExpression) {
  const {debug, genExpr} = context;
  let fmt = '';
  const args: Value<any>[] = [];
  for (const arg of node.arguments) {
    if (fmt.length > 0) {
      fmt += ' ';
    }
    if (ts.isStringLiteral(arg)) {
      fmt += arg.text;
    } else {
      // TODO: extract type from the signature and use
      // correct mask.
      const value = genExpr(arg);
      if (value == null) {
        fmt += 'null';
      } else if (value instanceof TsFunction) {
        fmt += `<function ${value.name}>`;
      } else {
        fmt += '%s';
        args.push(debug.debugValue(value));
      }
    }
  }

  debug.printf(fmt, args);
}

function identifierFactory({checker, declFunction, ref}: CompilerContext) {
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

    return ref(decl);
  };
}

function nullFactory({jslib}: CompilerContext) {
  return () => {
    return jslib.values.jsNull;
  };
}

function numericLiteralFactory(context: CompilerContext) {
  const {types, instr, checker} = context;
  return (node: ts.NumericLiteral) => {
    // TODO: type (llvm.ConstantFP.get(builder.getFloatTy(), 1.4))
    const num = types.i32.constValue(parseInt(node.text, 10));
    return num;
  }
}

function binaryExpressionFactory({jslib, genExpr}: CompilerContext) {
  return (node: ts.BinaryExpression) => {
    const left = genExpr(node.left);
    const right = genExpr(node.right);
    if (!(left instanceof Value<any>)) {
      throw new Error('cannot use value for binary expression');
    }
    if (!(right instanceof Value<any>)) {
      throw new Error('cannot use value for binary expression');
    }
    const op = node.operatorToken;
    if (op.kind === ts.SyntaxKind.PlusToken) {
      // TODO: better name: var name, etc?
      return jslib.add('add_res', left, right);
    }
    if (op.kind === ts.SyntaxKind.EqualsEqualsEqualsToken) {
      return jslib.strictEq('stricteq', left, right);
    }
    throw new Error(`unknown binary operator: ${ts.SyntaxKind[op.kind]} (${op.getText()})`);
  };
}
