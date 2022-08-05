import llvm from "llvm-bindings";
import ts from "typescript";
import { CompilerContext } from "../context";
import { GlobalVar } from "../instr/globalvar";
import { Pointer, Type, Value } from "../types/base";
import { JsCustObject } from "../types/jsobject";
import { JsType, JsValueType } from "../types/jsvalue";
import { StructFields, StructType } from "../types/struct";
import { VTable, VTableFields, VTableIfc, VTableITable } from "../types/vtable";

export class TsObj {
  public readonly ifcs: TsIfc[] = [];

  constructor(
    public readonly name: string,
    public readonly tsType: ts.Type,
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
    public readonly tsType: ts.Type,
    public readonly shape: StructFields,
    public readonly shapeType: StructType<any>
  ) {}
}

export function completeVTable(obj: TsObj, context: CompilerContext) {
  const { types } = context;
  const { vtable } = types;
  const { vtableVar } = obj;
  vtableVar.llVar.setInitializer(
    vtable.createConst({
      fields: computeFields(obj, context),
      itable: computeITable(obj, context),
    }).llValue as llvm.Constant
  );
}

function computeFields(
  obj: TsObj,
  context: CompilerContext
): Value<VTableFields> {
  const { types, instr, jslib } = context;
  const { vtable, i8, i32, jsString } = types;
  const { builder } = instr;
  const { name, shape } = obj;
  const vtFieldsType = vtable.fields.fields;
  const vtFieldType = vtFieldsType.fields.fields.toType;

  const shapeType = obj.type.cust;
  const nullptr = shapeType.pointerOf().nullptr();

  const vtFields = Object.entries(shape).map(([fieldName, gType]) => {
    const field = jslib.jsString.globalConstVar(fieldName);
    const isJsv = gType.isPointer() && gType.toType instanceof JsValueType;
    // TODO: bool and other boxed types.
    const jsType = isJsv
      ? gType.toType.jsType
      : gType.isA(i32)
      ? JsType.NUMBER
      : JsType.UNKNOWN;
    const fieldPtr = shapeType.gep(builder, nullptr, fieldName);
    const offset = builder.CreatePtrToInt(
      fieldPtr.llValue,
      builder.getInt32Ty()
    ) as llvm.Constant;

    return vtFieldType.createConst({
      field: jsString.pointer(field.llVar),
      jsType: i32.constValue(jsType),
      boxed: i8.constValue(isJsv ? 1 : 0),
      offset: new Value(i32, offset),
    });
  });

  return vtFieldsType.createConst({
    length: i32.constValue(vtFields.length),
    fields: createArrayConstPtr(
      `u/VT<${name}>/fields`,
      vtFieldType,
      vtFields,
      context
    ),
  });
}

function computeITable(
  obj: TsObj,
  context: CompilerContext
): Value<VTableITable> {
  const { types } = context;
  const { vtable, vtableIfc, i32 } = types;
  const { name } = obj;
  const itableType = vtable.fields.itable;

  const ifcs = obj.ifcs.map((ifc) => computeIfc(obj, ifc, context));

  return itableType.createConst({
    autoId: i32.constValue(obj.autoIfc.id),
    length: i32.constValue(ifcs.length),
    ifcs: createArrayConstPtr(`u/VT<${name}>/itable`, vtableIfc, ifcs, context),
  });
}

function computeIfc(
  obj: TsObj,
  ifc: TsIfc,
  context: CompilerContext
): Value<VTableIfc> {
  const { types, instr } = context;
  const { vtable, vtableIfcField, i8, i32 } = types;
  const { builder } = instr;
  const { name, shape } = obj;
  const itableType = vtable.fields.itable;
  const vtableIfcType = itableType.fields.ifcs.toType;

  const shapeType = obj.type.cust;
  const nullptr = shapeType.pointerOf().nullptr();

  const ifcFields = Object.entries(ifc.shape).map(([fieldName, gType]) => {
    const isJsv = gType.isPointer() && gType.toType instanceof JsValueType;
    // TODO: bool and other boxed types.
    const jsType = isJsv
      ? gType.toType.jsType
      : gType.isA(i32)
      ? JsType.NUMBER
      : JsType.UNKNOWN;

    let offset: llvm.Constant;
    if (fieldName in shape) {
      const fieldPtr = shapeType.gep(builder, nullptr, fieldName);
      offset = builder.CreatePtrToInt(
        fieldPtr.llValue,
        i32.llType
      ) as llvm.Constant;
    } else {
      offset = i32.constValue(-1).llValue as llvm.Constant;
    }

    return vtableIfcField.createConst({
      jsType: i32.constValue(jsType),
      boxed: i8.constValue(isJsv ? 1 : 0),
      offset: new Value(i32, offset),
    });
  });

  return vtableIfcType.createConst({
    id: i32.constValue(ifc.id),
    fields: createArrayConstPtr(
      `u/VT<${name}, ${ifc.name}>/fields`,
      vtableIfcField,
      ifcFields,
      context
    ),
  });
}

function createArrayConstPtr<T extends Type>(
  name: string,
  type: T,
  values: Value<T>[],
  context: CompilerContext
): Pointer<T> {
  const { instr, module } = context;
  const { builder } = instr;

  const arrayType = llvm.ArrayType.get(type.llType, values.length);
  const array = llvm.ConstantArray.get(
    arrayType,
    values.map((f) => f.llValue as llvm.Constant)
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
