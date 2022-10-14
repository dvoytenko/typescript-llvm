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
import { Pointer, Value } from "../../types";
import { tsToTypeUnboxed, tsToStructFields } from "../types";

export function propertyAccessExpressionFactory(context: CompilerContext) {
  const { types, instr, jslib, checker, genExpr, declIfc } = context;
  const { i32, i64, jsObject } = types;
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
      const valueType = tsToTypeUnboxed(
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

            const autoId = instr.loadStructField(
              instr.gepStructField(
                instr.loadStructField(targetPtr, "vtable"),
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
            const autoVal = instr.loadStructField(ifcPtr, propName);
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
            const offset = instr.loadStructField(fieldPtr, "offset");

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
