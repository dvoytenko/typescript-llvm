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
import type { ExprFactories } from ".";
import { CompilerContext } from "../../context";
import { Value } from "../../types/base";
import { StructFields, StructValues } from "../../types/struct";
import { notNull } from "../../util";
import { tsToTypeUnboxed } from "../types";

export const jsxExprFactories: ExprFactories = {
  [ts.SyntaxKind.JsxElement]: jsxElementFactory,
  [ts.SyntaxKind.JsxOpeningElement]: jsxOpeningElementFactory,
  [ts.SyntaxKind.JsxAttributes]: jsxAttributesFactory,
  [ts.SyntaxKind.JsxExpression]: jsxExpressionFactory,
};

function jsxElementFactory(context: CompilerContext) {
  const { types, instr, genExpr, getFunction, jslib } = context;
  return (node: ts.JsxElement) => {
    const props = genExpr(node.openingElement);
    if (!(props instanceof Value) || !props.isPointer()) {
      throw new Error("props are not a pointer");
    }

    const tagName = node.openingElement.tagName.getText();

    const children = node.children.filter(
      (child) => !ts.isJsxText(child) || !child.containsOnlyTriviaWhiteSpaces
    );

    const childenValues = children
      .map((child) => {
        const value = ts.isJsxText(child)
          ? jslib.jsString.globalConstVar(child.text.trim()).ptr
          : genExpr(child);
        if (value == null) {
          return null;
        }
        if (!(value instanceof Value)) {
          throw new Error(
            "cannot use value for JSX child: " +
              ts.SyntaxKind[child.kind] +
              " = " +
              value
          );
        }
        return instr.strictConvert(value, types.jsValue.pointerOf());
      })
      .filter(notNull);

    const childrenArray = jslib.jsArray.createWithValues(childenValues);

    const jsxFunction = getFunction("u/jsx")!.func;
    return instr.call("vnode", jsxFunction, [
      instr.castPtr(
        "tag_cast",
        jslib.jsString.globalConstVar(tagName).ptr,
        types.jsValue
      ),
      instr.castPtr("props_cast", props, types.jsValue),
      childrenArray,
    ]);
  };
}

function jsxOpeningElementFactory(context: CompilerContext) {
  const { genExpr } = context;
  return (node: ts.JsxOpeningElement) => {
    if (!ts.isIdentifier(node.tagName)) {
      // TODO: genExpr()
      throw new Error("Non-identifier JsxTagNameExpression not supported yet");
    }
    return genExpr(node.attributes);
  };
}

function jsxAttributesFactory(context: CompilerContext) {
  const { types, instr, jslib, checker, genExpr, declObjType } = context;
  return (node: ts.JsxAttributes) => {
    const shape: StructFields = {};
    const nameParts: string[] = [];
    const values: StructValues<any> = {};
    for (const prop of node.properties) {
      if (ts.isJsxAttribute(prop)) {
        const propName = prop.name.text;
        const propTsType = checker.getTypeAtLocation(prop);
        const propType = tsToTypeUnboxed(propTsType, prop, context);
        const propValue = prop.initializer
          ? genExpr(prop.initializer)
          : types.bool.constValue(true);
        if (!(propValue instanceof Value)) {
          throw new Error("cannot use value for JSX expression");
        }
        shape[propName] = propType;
        values[propName] = propValue;
        nameParts.push(`${propName}: ${checker.typeToString(propTsType)}`);
      } else {
        throw new Error("Non-supported JsxAttributeLike");
      }
    }

    const name = `{ ${nameParts.join(", ")} }`;
    const tsObj = declObjType(name, shape);

    const jsType = tsObj.type;
    const ptr = jslib.jsObject.create(jsType);
    const custPtr = instr.gepStructField(ptr, "cust");
    for (const [propName, propValue] of Object.entries(values)) {
      const propValueType = shape[propName];
      const propValueConv = instr.strictConvert(propValue, propValueType);
      jsType.cust.store(instr.builder, custPtr, propName, propValueConv);
    }
    return ptr;
  };
}

function jsxExpressionFactory(context: CompilerContext) {
  const { genExpr } = context;
  return (node: ts.JsxExpression) => {
    return node.expression ? genExpr(node.expression) : null;
  };
}
