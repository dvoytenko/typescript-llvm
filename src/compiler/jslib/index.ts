import { Debug } from "../debug";
import { Instr } from "../instr";
import { Function } from "../instr/func";
import { Globals } from "../instr/globals";
import { GlobalVar } from "../instr/globalvar";
import { Types } from "../types";
import {
  I32Type,
  Pointer,
  PointerType,
  Type,
  Value,
  VoidType,
} from "../types/base";
import { BoolType } from "../types/bool";
import { JsArray } from "../types/jsarray";
import { JsNullType } from "../types/jsnull";
import { JsNumberType } from "../types/jsnumber";
import { JsCustObject, JsObject } from "../types/jsobject";
import { JsString } from "../types/jsstring";
import {
  JsType,
  JsUnknownType,
  JsUnknownType2,
  JsValueType,
} from "../types/jsvalue";
import { StructType } from "../types/struct";
import { VTable, VTableIfcField } from "../types/vtable";

export interface JslibValues {
  jsNull: Pointer<JsNullType>;
  zero: Pointer<JsNumberType>;
  vtableEmpty: Pointer<VTable>;
  jsEmptyObject: JsCustObject;
}

type AddAnyArgs = [
  a: PointerType<JsUnknownType2>,
  b: PointerType<JsUnknownType2>
];

type SubAnyArgs = AddAnyArgs;

interface JslibFunctions {
  addAny: Function<PointerType<JsUnknownType2>, AddAnyArgs>;
  subAny: Function<PointerType<JsUnknownType2>, SubAnyArgs>;
  strictEqAny: Function<BoolType, AddAnyArgs>;
}

interface AddInstr {
  (name: string, a: Value<I32Type>, b: Value<I32Type>): Value<I32Type>;
  (
    name: string,
    a: Pointer<JsNumberType>,
    b: Pointer<JsNumberType>
  ): Pointer<JsNumberType>;
  (name: string, a: Value, b: Value): Pointer<JsUnknownType>;
}

type SubInstr = AddInstr;

interface StrictEqInstr {
  (name: string, a: Value, b: Value): Value<BoolType>;
}

interface JsArrayLib {
  createWithValues(values: Pointer<Type>[]): Pointer<JsArray>;
}

interface JsObjectLib {
  create(jsType: JsCustObject): Pointer<JsCustObject>;
  getField(
    ptr: Pointer<JsObject>,
    key: Pointer<JsValueType<any, any>>
  ): Pointer<JsValueType<any, any>>;
  setField(
    ptr: Pointer<JsObject>,
    key: Pointer<JsValueType<any, any>>,
    value: Pointer<JsValueType<any, any>>
  ): void;
  getIfc(ptr: Pointer<JsObject>, id: Value<I32Type>): Pointer<VTableIfcField>;
}

interface JsStringLib {
  globalConstVar: (s: string) => GlobalVar<JsString>;
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
    jsNullType.createConst({ jsType: i32.constValue(JsType.NULL) })
  ).ptr;
  const zero = instr.globalConstVar("zero", jsNumber.constValue(0)).ptr;
  const vtableEmpty = instr.globalConstVar(
    "vtableEmpty",
    vtable.createConst({
      fields: vtable.fields.fields.createConst({
        length: i32.constValue(0),
        fields: vtable.fields.fields.fields.fields.nullptr(),
      }),
      itable: vtable.fields.itable.createConst({
        autoId: i32.constValue(-1),
        length: i32.constValue(0),
        ifcs: vtable.fields.itable.fields.ifcs.nullptr(),
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
    addAny: addAnyFunctionFactory(gen),
    subAny: subAnyFunctionFactory(gen),
    strictEqAny: strictEqAnyFunctionFactory(gen),
  };
  return {
    instr: gen.instr,
    values,
    funcs,
    add: addFactory(gen, values, funcs),
    sub: subFactory(gen, values, funcs),
    strictEq: strictEqFactory(gen, values, funcs),
    jsArray: jsArrayFactory(gen),
    jsObject: jsObjectFactory(gen, values),
    jsString: jsStringFactory(gen),
  };
}

function addFactory(
  { instr, types }: Gen,
  values: JslibValues,
  funcs: JslibFunctions
): AddInstr {
  const { i32, jsNumber, jsValue } = types;
  const jsNumberPtr = jsNumber.pointerOf();
  const jsValuePtr = jsValue.pointerOf();
  return (name: string, a: Value, b: Value): Value<any> => {
    // TODO: the rules are incomplete and mostly wrong.

    // Both values are numeric: the result is numeric.
    if (
      (a.isA(i32) || a.isA(jsNumberPtr)) &&
      (b.isA(i32) || b.isA(jsNumberPtr))
    ) {
      const numA = a.isA(i32) ? a : instr.loadUnboxed(a);
      const numB = b.isA(i32) ? b : instr.loadUnboxed(b);
      const numRes = instr.add(`${name}_sum`, numA, numB);
      if (a.isA(jsNumberPtr) || b.isA(jsNumberPtr)) {
        const ptr = instr.malloc(name, jsNumber);
        instr.storeBoxed(ptr, numRes);
        return ptr;
      }
      return numRes;
    }

    // A mix of types.
    const jsvA = instr.strictConvert(a, jsValuePtr);
    const jsvB = instr.strictConvert(b, jsValuePtr);
    return instr.call(name, funcs.addAny, [jsvA, jsvB]);
  };
}

function addAnyFunctionFactory({ instr, types }: Gen) {
  const { jsValue } = types;
  const jsValuePtr = jsValue.pointerOf();
  const func = instr.func(
    "jsValue_add",
    types.func<PointerType<JsUnknownType2>, AddAnyArgs>(
      jsValuePtr as PointerType<JsUnknownType2>,
      [
        jsValuePtr as PointerType<JsUnknownType2>,
        jsValuePtr as PointerType<JsUnknownType2>,
      ]
    ),
    ["readonly"]
  );
  return func;
}

function subFactory(
  { instr, types }: Gen,
  values: JslibValues,
  funcs: JslibFunctions
): SubInstr {
  const { i32, jsNumber, jsValue } = types;
  const jsNumberPtr = jsNumber.pointerOf();
  const jsValuePtr = jsValue.pointerOf();
  return (name: string, a: Value, b: Value): Value<any> => {
    // TODO: the rules are incomplete and mostly wrong.

    // Both values are numeric: the result is numeric.
    if (
      (a.isA(i32) || a.isA(jsNumberPtr)) &&
      (b.isA(i32) || b.isA(jsNumberPtr))
    ) {
      const numA = a.isA(i32) ? a : instr.loadUnboxed(a);
      const numB = b.isA(i32) ? b : instr.loadUnboxed(b);
      const numRes = instr.sub(`${name}_sub`, numA, numB);
      if (a.isA(jsNumberPtr) || b.isA(jsNumberPtr)) {
        const ptr = instr.malloc(name, jsNumber);
        instr.storeBoxed(ptr, numRes);
        return ptr;
      }
      return numRes;
    }

    // A mix of types.
    const jsvA = instr.strictConvert(a, jsValuePtr);
    const jsvB = instr.strictConvert(b, jsValuePtr);
    return instr.call(name, funcs.subAny, [jsvA, jsvB]);
  };
}

function subAnyFunctionFactory({ instr, types }: Gen) {
  const { jsValue } = types;
  const jsValuePtr = jsValue.pointerOf();
  return instr.func(
    "jsValue_sub",
    types.func<PointerType<JsUnknownType2>, SubAnyArgs>(
      jsValuePtr as PointerType<JsUnknownType2>,
      [
        jsValuePtr as PointerType<JsUnknownType2>,
        jsValuePtr as PointerType<JsUnknownType2>,
      ]
    ),
    ["readonly"]
  );
}

function strictEqFactory(
  { instr, types }: Gen,
  values: JslibValues,
  funcs: JslibFunctions
): StrictEqInstr {
  const { i32, bool, jsNull, jsNumber, jsValue } = types;
  const jsNullPtr = jsNull.pointerOf();
  const jsNumberPtr = jsNumber.pointerOf();
  const jsValuePtr = jsValue.pointerOf();
  return (name: string, a: Value, b: Value): Value<BoolType> => {
    // TODO: the rules are incomplete and mostly wrong.

    // Both values are nulls: equality is confirmed.
    if (a.isA(jsNullPtr) && b.isA(jsNullPtr)) {
      // debug.printf('BOTH NULL', []);
      return bool.constValue(true);
    }

    // One value is null (`a === null`): check whether the other one is too.
    if (a.isA(jsNullPtr) || b.isA(jsNullPtr)) {
      // debug.printf('ONE NULL', []);
      const other = instr.strictConvert(a.isA(jsNullPtr) ? b : a, jsValuePtr);
      const otherJsType = other.type.toType.loadJsType(instr.builder, other);
      return instr.icmpEq(name, otherJsType, i32.constValue(jsNull.jsType));
    }

    // Both values are numeric: compare numbers.
    if (
      (a.isA(i32) || a.isA(jsNumberPtr)) &&
      (b.isA(i32) || b.isA(jsNumberPtr))
    ) {
      // debug.printf('BOTH NUM', []);
      const numA = a.isA(i32) ? a : instr.loadUnboxed(a);
      const numB = b.isA(i32) ? b : instr.loadUnboxed(b);
      return instr.icmpEq(name, numA, numB);
    }

    // A mix of types.
    // debug.printf('MIX OF TYPES', []);
    const jsvA = instr.strictConvert(a, jsValuePtr);
    const jsvB = instr.strictConvert(b, jsValuePtr);
    return instr.call(name, funcs.strictEqAny, [jsvA, jsvB]);
  };
}

function strictEqAnyFunctionFactory({ instr, types }: Gen) {
  const { bool, jsValue } = types;
  const jsValuePtr = jsValue.pointerOf();
  return instr.func(
    "jsValue_strictEq",
    types.func<BoolType, AddAnyArgs>(bool, [
      jsValuePtr as PointerType<JsUnknownType2>,
      jsValuePtr as PointerType<JsUnknownType2>,
    ]),
    ["readonly"]
  );
}

function jsArrayFactory({ types, instr }: Gen): JsArrayLib {
  const { jsArray, jsValue, i32, i64 } = types;
  return {
    createWithValues(values: Pointer<Type>[]): Pointer<JsArray> {
      const arr = instr.malloc(
        "arr",
        jsValue.pointerOf(),
        i64.constValue(values.length)
      );
      for (let i = 0; i < values.length; i++) {
        const value = values[i];
        const convValue = instr.strictConvert(value, jsValue.pointerOf());
        const valuePtr = new Pointer(
          arr.type.toType,
          instr.builder.CreateGEP(jsValue.pointerOf().llType, arr.llValue, [
            i32.constValue(i).llValue,
          ])
        );
        instr.store(valuePtr, convValue);
      }

      const ptr = instr.malloc("jsa", jsArray);
      jsArray.storeStruct(instr.builder, ptr, {
        jsType: i32.constValue(jsArray.jsType),
        length: i32.constValue(values.length),
        arr,
      });
      return ptr;
    },
  };
}

function jsObjectFactory(
  { types, instr }: Gen,
  values: JslibValues
): JsObjectLib {
  const { voidType, jsValue, jsString, jsObject, vtable, vtableIfcField, i32 } =
    types;
  const jsStringPtr = jsString.pointerOf();
  const jsObjectPtr = jsObject.pointerOf();
  const jsValuePtr = jsValue.pointerOf();
  const vtablePtr = vtable.pointerOf();

  const keyToString = (key: Pointer<JsValueType<any, any>>) =>
    instr.strictConvert(key, types.jsString.pointerOf());

  const jsObject_init = instr.func(
    "jsObject_init",
    types.func(voidType, [jsObjectPtr, vtablePtr])
  );

  const jsObject_getField = instr.func(
    "jsObject_getField",
    types.func(jsValuePtr, [jsObjectPtr, jsStringPtr]),
    ["readonly"]
  );
  const jsObject_setField = instr.func<
    VoidType,
    [
      PointerType<JsObject>,
      PointerType<JsString>,
      PointerType<JsValueType<any, any>>
    ]
  >(
    "jsObject_setField",
    types.func(voidType, [jsObjectPtr, jsStringPtr, jsValuePtr])
  );
  const vTable_getIfc = instr.func(
    "vTable_getIfc",
    types.func(vtableIfcField.pointerOf(), [jsObjectPtr, i32]),
    ["readonly"]
  );

  return {
    create(jsType: JsCustObject) {
      const ptr = instr.malloc("jso", jsType);
      const ptr0 = instr.strictConvert(ptr, jsObjectPtr);
      instr.callVoid(jsObject_init, [
        ptr0,
        jsType.vtablePtr ?? values.vtableEmpty,
      ]);
      // QQQQ: zeroinitializer for cust?
      return ptr;
    },
    getField(ptr: Pointer<JsObject>, key: Pointer<JsValueType<any, any>>) {
      const ptr0 = instr.strictConvert(ptr, jsObjectPtr);
      return instr.call("get_field", jsObject_getField, [
        ptr0,
        keyToString(key),
      ]);
    },
    setField(
      ptr: Pointer<JsObject>,
      key: Pointer<JsValueType<any, any>>,
      value: Pointer<JsValueType<any, any>>
    ) {
      const ptr0 = instr.strictConvert(ptr, jsObjectPtr);
      instr.callVoid(jsObject_setField, [ptr0, keyToString(key), value]);
    },
    getIfc(
      ptr: Pointer<JsObject>,
      id: Value<I32Type>
    ): Pointer<VTableIfcField> {
      const ptr0 = instr.strictConvert(ptr, jsObjectPtr);
      return instr.call("get_ifc", vTable_getIfc, [ptr0, id]);
    },
  };
}

function jsStringFactory({ types, instr }: Gen): JsStringLib {
  const { jsString } = types;
  const globalConstVars = new Globals<GlobalVar<JsString>, [string]>(
    (name, value) => {
      const jss = jsString.constValue(instr, value);
      return instr.globalConstVar(`jss.${name}`, jss);
    }
  );
  return {
    globalConstVar(s: string): GlobalVar<JsString> {
      return globalConstVars.get(s, s);
    },
  };
}
