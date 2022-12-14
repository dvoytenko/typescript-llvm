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

import llvm from "llvm-bindings";
import {
  BoxedType,
  ConstValue,
  Pointer,
  PointerType,
  PrimitiveType,
  Type,
  Value,
  VoidType,
} from "./base";
import { BoolType } from "./bool";
import { FunctionType } from "./func";
import { I32Type, I64Type, I8Type, IntType } from "./inttype";
import { JsArray } from "./jsarray";
import { JsNull } from "./jsnull";
import { JsNumber } from "./jsnumber";
import { JsCustObject, JsObject } from "./jsobject";
import { JsString } from "./jsstring";
import { JsType, JsValue } from "./jsvalue";
import { JsvMap } from "./jsvmap";
import { StructFields, StructType } from "./struct";
import { VTable, VTableIfc, VTableIfcField } from "./vtable";

export {
  BoolType,
  BoxedType,
  ConstValue,
  I32Type,
  I64Type,
  IntType,
  Pointer,
  PointerType,
  PrimitiveType,
  StructType,
  Type,
  Value,
  VoidType,
  JsValue,
  JsNumber,
};

export interface Types {
  context: llvm.LLVMContext;
  voidType: VoidType;
  i8: I8Type;
  i32: I32Type;
  i64: I64Type;
  bool: BoolType;
  pointer: <T extends Type>(type: T) => PointerType<T>;
  struct: <Fields extends StructFields>(
    name: string,
    fields: Fields
  ) => StructType<Fields>;
  func: <Ret extends Type, Args extends [...Type[]]>(
    retType: Ret,
    args: [...Args]
  ) => FunctionType<Ret, Args>;
  vtable: VTable;
  vtableIfc: VTableIfc;
  vtableIfcField: VTableIfcField;
  jsvMap: JsvMap;
  jsValue: JsValue;
  jsNull: JsNull;
  jsNumber: JsNumber;
  jsString: JsString;
  jsArray: JsArray;
  jsObject: JsObject;
  jsCustObject: (
    name: string,
    cust: StructType<any>,
    vtable: Pointer<VTable>
  ) => JsCustObject;
}

export function types(context: llvm.LLVMContext): Types {
  const jsValue = new JsValue(context, JsType.UNKNOWN, {});
  const jsString = new JsString(context);
  const jsArray = new JsArray(context, jsValue);
  const vtable = new VTable(context, jsString);
  const vtableIfc = vtable.fields.itable.fields.ifcs.toType;
  const vtableIfcField = vtableIfc.fields.fields.toType;
  const jsvMap = new JsvMap(context, jsString, jsValue);
  return {
    context,
    voidType: new VoidType(context),
    i8: new I8Type(context),
    i32: new I32Type(context),
    i64: new I64Type(context),
    bool: new BoolType(context),
    pointer: <T extends Type>(type: T) => PointerType.of(type),
    struct: <Fields extends StructFields>(name: string, fields: Fields) =>
      new StructType(context, name, fields),
    func: <Ret extends Type, Args extends [...Type[]]>(
      retType: Ret,
      args: Args
    ) => new FunctionType(context, retType, args),
    vtable,
    vtableIfc,
    vtableIfcField,
    jsvMap,
    jsValue,
    jsNull: new JsNull(context),
    jsNumber: new JsNumber(context),
    jsString,
    jsArray,
    jsObject: new JsObject(context, vtable, jsvMap),
    jsCustObject: (
      name: string,
      cust: StructType<any>,
      vtablePtr: Pointer<VTable>
    ) => {
      return new JsCustObject(context, vtable, jsvMap, name, cust, vtablePtr);
    },
  };
}
