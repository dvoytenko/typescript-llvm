import { Debug } from "../debug";
import { Instr } from "../instr";
import { Types } from "../types";
import { JsType } from "../types/jsvalue";
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
import {
  createEmptyJsObject,
  createEmptyVtable,
  jsObjectFactory,
  JsObjectLib,
} from "./jsobject";
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
  const { i32, jsNull: jsNullType, jsNumber } = types;
  const jsNull = instr.globalConstVar(
    "jsnull",
    jsNullType.constStruct({ jsType: i32.constValue(JsType.NULL) })
  ).ptr;
  const zero = instr.globalConstVar("zero", jsNumber.constValue(0)).ptr;
  const vtableEmpty = createEmptyVtable(instr);
  const values: JslibValues = {
    jsNull,
    zero,
    vtableEmpty,
    jsEmptyObject: createEmptyJsObject(instr, vtableEmpty),
  };
  const funcs: JslibFunctions = {
    addAny: addAnyFunctionFactory(instr),
    subAny: subAnyFunctionFactory(instr),
    strictEqAny: strictEqAnyFunctionFactory(instr),
  };
  return {
    instr,
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
