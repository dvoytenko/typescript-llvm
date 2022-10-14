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
import { CompilerContext } from "../context";
import { GlobalVar } from "../instr/globalvar";
import { ConstValue, Pointer, Type } from "../types/base";
import { JsCustObject } from "../types/jsobject";
import { JsType, JsValue } from "../types/jsvalue";
import { StructFields, StructType } from "../types/struct";
import { VTable, VTableFields, VTableIfc, VTableITable } from "../types/vtable";

export class TsObj {
  public readonly ifcs: TsIfc[] = [];

  constructor(
    public readonly name: string,
    public readonly shape: StructFields,
    public readonly type: JsCustObject,
    public readonly vtableVar: GlobalVar<VTable>,
    public readonly autoIfc: TsIfc
  ) {}
}

export class TsIfc {
  constructor(
    public readonly id: number,
    public readonly name: string,
    public readonly shape: StructFields,
    public readonly shapeType: StructType<any>
  ) {}
}

export function completeVTable(obj: TsObj, context: CompilerContext) {
  const { types } = context;
  const { vtable } = types;
  const { vtableVar } = obj;
  vtableVar.llVar.setInitializer(
    vtable.constStruct({
      fields: computeFields(obj, context),
      itable: computeITable(obj, context),
    }).llValue
  );
}

function computeFields(
  obj: TsObj,
  context: CompilerContext
): ConstValue<VTableFields> {
  const { types, instr, jslib } = context;
  const { vtable, i8, i32 } = types;
  const { builder } = instr;
  const { name, shape } = obj;
  const vtFieldsType = vtable.fields.fields;
  const vtFieldType = vtFieldsType.fields.fields.toType;

  const shapeType = obj.type.cust;
  const nullptr = shapeType.pointerOf().nullptr();

  const vtFields = Object.entries(shape).map(([fieldName, type]) => {
    const field = jslib.jsString.globalConstVar(fieldName);
    const isJsv = type.isPointerTo(JsValue);
    // TODO: bool and other boxed types.
    const jsType = isJsv
      ? type.toType.jsType
      : type.isA(i32)
      ? JsType.NUMBER
      : JsType.UNKNOWN;
    const fieldPtr = instr.gepStructField(nullptr, fieldName);
    const offset = builder.CreatePtrToInt(
      fieldPtr.llValue,
      builder.getInt32Ty()
    ) as llvm.Constant;

    return vtFieldType.constStruct({
      field: field.ptr.asConst(),
      jsType: i32.constValue(jsType),
      boxed: i8.constValue(isJsv ? 1 : 0),
      offset: i32.constValue(offset),
    });
  });

  return vtFieldsType.constStruct({
    length: i32.constValue(vtFields.length),
    fields: createArrayConstPtr(
      `u/VT<${name}>/fields`,
      vtFieldType,
      vtFields,
      context
    ).asConst(),
  });
}

function computeITable(
  obj: TsObj,
  context: CompilerContext
): ConstValue<VTableITable> {
  const { types } = context;
  const { vtable, vtableIfc, i32 } = types;
  const { name } = obj;
  const itableType = vtable.fields.itable;

  const ifcs = obj.ifcs.map((ifc) => computeIfc(obj, ifc, context));

  return itableType.constStruct({
    autoId: i32.constValue(obj.autoIfc.id),
    length: i32.constValue(ifcs.length),
    ifcs: createArrayConstPtr(
      `u/VT<${name}>/itable`,
      vtableIfc,
      ifcs,
      context
    ).asConst(),
  });
}

function computeIfc(
  obj: TsObj,
  ifc: TsIfc,
  context: CompilerContext
): ConstValue<VTableIfc> {
  const { types, instr } = context;
  const { vtable, vtableIfcField, i8, i32 } = types;
  const { builder } = instr;
  const { name, shape } = obj;
  const itableType = vtable.fields.itable;
  const vtableIfcType = itableType.fields.ifcs.toType;

  const shapeType = obj.type.cust;
  const nullptr = shapeType.pointerOf().nullptr();

  const ifcFields = Object.entries(ifc.shape).map(([fieldName, type]) => {
    const isJsv = type.isPointerTo(JsValue);
    // TODO: bool and other boxed types.
    const jsType = isJsv
      ? type.toType.jsType
      : type.isA(i32)
      ? JsType.NUMBER
      : JsType.UNKNOWN;

    let offset: llvm.Constant;
    if (fieldName in shape) {
      const fieldPtr = instr.gepStructField(nullptr, fieldName);
      offset = builder.CreatePtrToInt(
        fieldPtr.llValue,
        i32.llType
      ) as llvm.Constant;
    } else {
      offset = i32.constValue(-1).llValue;
    }

    return vtableIfcField.constStruct({
      jsType: i32.constValue(jsType),
      boxed: i8.constValue(isJsv ? 1 : 0),
      offset: i32.constValue(offset),
    });
  });

  return vtableIfcType.constStruct({
    id: i32.constValue(ifc.id),
    fields: createArrayConstPtr(
      `u/VT<${name}, ${ifc.name}>/fields`,
      vtableIfcField,
      ifcFields,
      context
    ).asConst(),
  });
}

function createArrayConstPtr<T extends Type>(
  name: string,
  type: T,
  values: ConstValue<T>[],
  context: CompilerContext
): Pointer<T> {
  const { instr, module } = context;
  const { builder } = instr;

  const arrayType = llvm.ArrayType.get(type.llType, values.length);
  const array = llvm.ConstantArray.get(
    arrayType,
    values.map((f) => f.llValue)
  );
  const arrayVar = new llvm.GlobalVariable(
    module,
    /* type */ arrayType,
    /* isConstant */ true,
    /* linkage */ llvm.GlobalValue.LinkageTypes.PrivateLinkage,
    /* initializer */ array,
    name
  );
  const arrayVarPtr = builder.CreateBitCast(arrayVar, type.pointerOf().llType);
  return type.pointer(arrayVarPtr);
}
