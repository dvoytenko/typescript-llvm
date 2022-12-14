/*
Copyright 2022 Google LLC

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    https://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import ts from "typescript";
import { CompilerContext } from "../../context";
import { Value } from "../../types";
import { TsFunction } from "../func";

export function callFactory(context: CompilerContext) {
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
