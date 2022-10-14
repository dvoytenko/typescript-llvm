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
