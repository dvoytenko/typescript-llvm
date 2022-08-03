import { Debug } from "../debug";
import { Instr } from "../instr";
import { Function } from "../instr/func";
import { Types } from "../types";
import { I32Type, Pointer, PointerType, Value, VoidType } from "../types/base";
import { BoolType } from "../types/bool";
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

export interface JslibValues {
  jsNull: Pointer<JsNullType>;
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
  (name: string, a: Value<any>, b: Value<any>): Pointer<JsUnknownType>;
}

type SubInstr = AddInstr;

interface StrictEqInstr {
  (name: string, a: Value<any>, b: Value<any>): Value<BoolType>;
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
}

export interface Jslib {
  instr: Instr;
  values: JslibValues;
  funcs: JslibFunctions;
  add: AddInstr;
  sub: SubInstr;
  strictEq: StrictEqInstr;
  jsObject: JsObjectLib;
}

export interface Gen {
  instr: Instr;
  types: Types;
  debug: Debug;
}

export function jslibFactory(gen: Gen): Jslib {
  const i32 = gen.types.i32;
  const values: JslibValues = {
    jsNull: gen.instr.globalConstVar(
      "jsnull",
      gen.types.jsNull.createConst({ jsType: i32.constValue(JsType.NULL) })
    ).ptr,
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
    jsObject: jsObjectFactory(gen),
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
  return (name: string, a: Value<any>, b: Value<any>): Value<any> => {
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
    )
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
  return (name: string, a: Value<any>, b: Value<any>): Value<any> => {
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
    )
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
  return (name: string, a: Value<any>, b: Value<any>): Value<BoolType> => {
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
    ])
  );
}

function jsObjectFactory({ types, instr }: Gen): JsObjectLib {
  const { voidType, jsValue, jsString, jsObject } = types;
  const jsStringPtr = jsString.pointerOf();
  const jsObjectPtr = jsObject.pointerOf();
  const jsValuePtr = jsValue.pointerOf();

  const keyToString = (key: Pointer<JsValueType<any, any>>) =>
    instr.strictConvert(key, types.jsString.pointerOf());

  const jsObject_init = instr.func(
    "jsObject_init",
    types.func(voidType, [jsObjectPtr])
  );

  const jsObject_getField = instr.func(
    "jsObject_getField",
    types.func(jsValuePtr, [jsObjectPtr, jsStringPtr])
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

  return {
    create(jsType: JsCustObject) {
      const ptr = instr.malloc("jso", jsType);
      const ptr0 = instr.strictConvert(ptr, jsObjectPtr);
      instr.callVoid(jsObject_init, [ptr0]);
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
  };
}
