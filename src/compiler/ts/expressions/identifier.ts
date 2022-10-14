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
