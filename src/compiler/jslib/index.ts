import { Debug } from "../debug";
import { Instr } from "../instr";
import { Function } from "../instr/func";
import { Types } from "../types";
import { I32Type, Pointer, PointerType, Value } from "../types/base";
import { BoolType } from "../types/bool";
import { JsNullType } from "../types/jsnull";
import { JsNumberType } from "../types/jsnumber";
import {
  JsObject,
  JsObjectHelper,
  jsObjectHelperFactory,
} from "../types/jsobject";
import {
  JsString,
  JsStringHelper,
  jsStringHelperFactory,
} from "../types/jsstring";
import { JsType, JsUnknownType, JsUnknownType2 } from "../types/jsvalue";
import { JsvMap, JsvMapHelper, jsvMapHelperFactory } from "../types/jsvmap";

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

export interface Jslib {
  instr: Instr;
  values: JslibValues;
  funcs: JslibFunctions;
  add: AddInstr;
  sub: SubInstr;
  strictEq: StrictEqInstr;
  jsvMapHelper: (ptr: Pointer<JsvMap>) => JsvMapHelper;
  jsStringHelper: (ptr: Pointer<JsString>) => JsStringHelper;
  jsObjectHelper: (ptr: Pointer<JsObject>) => JsObjectHelper;
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
    addAny: addAnyFunctionFactory(gen, values),
    subAny: subAnyFunctionFactory(gen, values),
    strictEqAny: strictEqAnyFunctionFactory(gen),
  };
  const jsStringHelper = jsStringHelperFactory(gen.types, gen.instr);
  const jsvMapHelper = jsvMapHelperFactory(
    gen.types,
    gen.instr,
    gen.debug,
    values,
    jsStringHelper
  );
  const jsObjectHelper = jsObjectHelperFactory(
    gen.types,
    gen.instr,
    gen.debug,
    values,
    jsvMapHelper
  );
  return {
    instr: gen.instr,
    values,
    funcs,
    add: addFactory(gen, values, funcs),
    sub: subFactory(gen, values, funcs),
    strictEq: strictEqFactory(gen, values, funcs),
    jsvMapHelper,
    jsStringHelper,
    jsObjectHelper,
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

function addAnyFunctionFactory({ instr, types }: Gen, values: JslibValues) {
  const { i32, jsValue, jsNumber } = types;
  const jsValuePtr = jsValue.pointerOf();
  const funcType = types.func<PointerType<JsUnknownType2>, AddAnyArgs>(
    jsValuePtr as PointerType<JsUnknownType2>,
    [
      jsValuePtr as PointerType<JsUnknownType2>,
      jsValuePtr as PointerType<JsUnknownType2>,
    ]
  );
  const func = instr.func("jslib/add", funcType);
  instr.insertPoint(instr.block(func, "entry"));

  const uptrA = func.args[0];
  const uptrB = func.args[1];

  // TODO: remove builder
  const jsTypeA = uptrA.type.toType.loadJsType(instr.builder, uptrA);
  const jsTypeB = uptrA.type.toType.loadJsType(instr.builder, uptrB);
  // debug.printf('ADD: TYPES: %d %d', [jsTypeA, jsTypeB]);

  const isNumA = instr.icmpEq(
    "is_num_a",
    jsTypeA,
    i32.constValue(JsType.NUMBER)
  );
  const isNumB = instr.icmpEq(
    "is_num_b",
    jsTypeB,
    i32.constValue(JsType.NUMBER)
  );

  const num1Block = instr.block(func, "num1");
  const num2Block = instr.block(func, "num2");
  const unkBlock = instr.block(func, "unk");

  instr.condBr(isNumA, num1Block, unkBlock);

  instr.insertPoint(num1Block);
  instr.condBr(isNumB, num2Block, unkBlock);

  instr.insertPoint(num2Block);

  const ptrA = instr.cast("jsn_a", uptrA, jsNumber);
  const ptrB = instr.cast("jsn_b", uptrB, jsNumber);

  const unboxedA = instr.loadUnboxed(ptrA);
  const unboxedB = instr.loadUnboxed(ptrB);

  const computedSum = instr.add("sum", unboxedA, unboxedB);

  const ptrSum = instr.malloc("jsn_sum", types.jsNumber);
  instr.storeBoxed(ptrSum, computedSum);

  instr.ret(func, instr.cast("sum_jsv", ptrSum, jsValue));

  instr.insertPoint(unkBlock);

  // TODO: string, other types, toPrimitive, undefined.
  // debug.printf('ADD: RETURN NULL BY DEFAULT', []);
  instr.ret(func, instr.cast("jsv_null", values.jsNull, jsValue));

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

function subAnyFunctionFactory({ instr, types }: Gen, values: JslibValues) {
  const { i32, jsValue, jsNumber } = types;
  const jsValuePtr = jsValue.pointerOf();
  const funcType = types.func<PointerType<JsUnknownType2>, SubAnyArgs>(
    jsValuePtr as PointerType<JsUnknownType2>,
    [
      jsValuePtr as PointerType<JsUnknownType2>,
      jsValuePtr as PointerType<JsUnknownType2>,
    ]
  );
  const func = instr.func("jslib/sub", funcType);
  instr.insertPoint(instr.block(func, "entry"));

  const uptrA = func.args[0];
  const uptrB = func.args[1];

  // TODO: remove builder
  const jsTypeA = uptrA.type.toType.loadJsType(instr.builder, uptrA);
  const jsTypeB = uptrA.type.toType.loadJsType(instr.builder, uptrB);

  const isNumA = instr.icmpEq(
    "is_num_a",
    jsTypeA,
    i32.constValue(JsType.NUMBER)
  );
  const isNumB = instr.icmpEq(
    "is_num_b",
    jsTypeB,
    i32.constValue(JsType.NUMBER)
  );

  const num1Block = instr.block(func, "num1");
  const num2Block = instr.block(func, "num2");
  const unkBlock = instr.block(func, "unk");

  instr.condBr(isNumA, num1Block, unkBlock);

  instr.insertPoint(num1Block);
  instr.condBr(isNumB, num2Block, unkBlock);

  instr.insertPoint(num2Block);

  const ptrA = instr.cast("jsn_a", uptrA, jsNumber);
  const ptrB = instr.cast("jsn_b", uptrB, jsNumber);

  const unboxedA = instr.loadUnboxed(ptrA);
  const unboxedB = instr.loadUnboxed(ptrB);

  const computedSub = instr.sub("sub", unboxedA, unboxedB);

  const ptrSub = instr.malloc("jsn_sub", types.jsNumber);
  instr.storeBoxed(ptrSub, computedSub);

  instr.ret(func, instr.cast("sub_jsv", ptrSub, jsValue));

  instr.insertPoint(unkBlock);

  // TODO: string, other types, toPrimitive, undefined.
  instr.ret(func, instr.cast("jsv_null", values.jsNull, jsValue));

  return func;
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
  const funcType = types.func<BoolType, AddAnyArgs>(bool, [
    jsValuePtr as PointerType<JsUnknownType2>,
    jsValuePtr as PointerType<JsUnknownType2>,
  ]);
  const func = instr.func("jslib/stricteq", funcType);

  instr.insertPoint(instr.block(func, "entry"));

  const uptrA = func.args[0];
  const uptrB = func.args[1];

  // TODO: remove builder
  const jsTypeA = uptrA.type.toType.loadJsType(instr.builder, uptrA);
  const jsTypeB = uptrA.type.toType.loadJsType(instr.builder, uptrB);

  const isSameJsType = instr.icmpEq("is_same_jstype", jsTypeA, jsTypeB);

  const falseBlock = instr.block(func, "false");
  const sameJsTypeBlock = instr.block(func, "same_jstype");

  instr.condBr(isSameJsType, sameJsTypeBlock, falseBlock);

  instr.insertPoint(sameJsTypeBlock);

  // QQQQ: not correct.
  instr.ret(func, bool.constValue(false));

  instr.insertPoint(falseBlock);

  // TODO: string, other types, toBoolean, undefined.
  instr.ret(func, bool.constValue(false));

  return func;
}
