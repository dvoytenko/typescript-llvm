import { Debug } from "../debug";
import { Instr } from "../instr";
import { Types } from "../types";
import { JsType } from "../types/jsvalue";
import { StructType } from "../types/struct";
import {
  addAnyFunctionFactory,
  AddAnyType,
  addFactory,
  AddInstr,
  subAnyFunctionFactory,
  SubAnyType,
  subFactory,
  SubInstr,
} from "./arithm";
import { JslibValues } from "./values";
import { jsObjectFactory, JsObjectLib } from "./jsobject";
import {
  strictEqAnyFunctionFactory,
  strictEqFactory,
  StrictEqFunction,
  StrictEqInstr,
} from "./stricteq";
import { jsStringFactory, JsStringLib } from "./jsstring";
import { jsArrayFactory, JsArrayLib } from "./jsarray";

export interface JslibFunctions {
  addAny: AddAnyType;
  subAny: SubAnyType;
  strictEqAny: StrictEqFunction;
}

export interface Jslib {
  instr: Instr;
  values: JslibValues;
  funcs: JslibFunctions;
  add: AddInstr;
  sub: SubInstr;
  strictEq: StrictEqInstr;
  jsArray: JsArrayLib;
  jsObject: JsObjectLib;
  jsString: JsStringLib;
}

export interface Gen {
  instr: Instr;
  types: Types;
  debug: Debug;
}

export function jslibFactory(gen: Gen): Jslib {
  const { types, instr } = gen;
  const { i32, jsNull: jsNullType, jsNumber, vtable } = types;
  const jsNull = instr.globalConstVar(
    "jsnull",
    jsNullType.constStruct({ jsType: i32.constValue(JsType.NULL) })
  ).ptr;
  const zero = instr.globalConstVar("zero", jsNumber.constValue(0)).ptr;
  const vtableEmpty = instr.globalConstVar(
    "vtableEmpty",
    vtable.constStruct({
      fields: vtable.fields.fields.constStruct({
        length: i32.constValue(0),
        fields: vtable.fields.fields.fields.fields.nullptr().asConst(),
      }),
      itable: vtable.fields.itable.constStruct({
        autoId: i32.constValue(-1),
        length: i32.constValue(0),
        ifcs: vtable.fields.itable.fields.ifcs.nullptr().asConst(),
      }),
    })
  ).ptr;
  const values: JslibValues = {
    jsNull,
    zero,
    vtableEmpty,
    jsEmptyObject: types.jsCustObject(
      "JsCustObject.None",
      new StructType(types.context, "None", {}),
      vtableEmpty
    ),
  };
  const funcs: JslibFunctions = {
    addAny: addAnyFunctionFactory(instr),
    subAny: subAnyFunctionFactory(instr),
    strictEqAny: strictEqAnyFunctionFactory(instr),
  };
  return {
    instr: gen.instr,
    values,
    funcs,
    add: addFactory(instr, funcs.addAny),
    sub: subFactory(instr, funcs.subAny),
    strictEq: strictEqFactory(instr, funcs.strictEqAny),
    jsArray: jsArrayFactory(instr),
    jsObject: jsObjectFactory(instr, values),
    jsString: jsStringFactory(instr),
  };
}
