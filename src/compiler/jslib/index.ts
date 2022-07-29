import llvm from 'llvm-bindings';
import { Debug } from '../debug';
import { Instr } from '../instr';
import { Function } from '../instr/func';
import { Types } from '../types';
import { I32Type, IntType, Pointer, PointerType, Value } from '../types/base';
import { JsNullType } from '../types/jsnull';
import { JsNumberType } from '../types/jsnumber';
import { JsType, JsUnknownType, JsUnknownType2, JsValueType } from '../types/jsvalue';

interface JslibValues {
  jsNull: Pointer<JsNullType>,
}

interface JslibFunctions {
  addAny: Function<PointerType<JsUnknownType2>, {a: PointerType<JsUnknownType2>, b: PointerType<JsUnknownType2>}>;
}

interface AddInstr {
  (a: Value<I32Type>, b: Value<I32Type>): Value<I32Type>;
  (a: Pointer<JsNumberType>, b: Pointer<JsNumberType>): Pointer<JsNumberType>;
  (a: Value<any>, b: Value<any>): Pointer<JsUnknownType>;
}

export interface Jslib {
  values: JslibValues,
  funcs: JslibFunctions,
  add: AddInstr;
}

export interface Gen {
  instr: Instr;
  types: Types;
  debug: Debug;
}

export function jslibFactory(gen: Gen): Jslib {
  const i32 = gen.types.i32;
  const values: JslibValues = {
    jsNull: gen.instr.globalConstVar("jsnull", gen.types.jsNull.createConst({jsType: i32.constValue(JsType.NULL)})).ptr,
  };
  const funcs: JslibFunctions = {
    addAny: addAnyFunctionFactory(gen, values),
  };
  return {
    values,
    funcs,
    add: addFactory(gen, values, funcs),
  };
}

function addFactory({instr, types, debug}: Gen, values: JslibValues, funcs: JslibFunctions): AddInstr {
  const {i32, jsNumber, jsValue} = types;
  const jsNumberPtr = jsNumber.pointerOf();
  const jsValuePtr = jsValue.pointerOf();
  return (a: Value<any>, b: Value<any>): Value<any> => {
    // TODO: the rules are incomplete and mostly wrong.

    // Both values are numeric: the result is numeric.
    if ((a.isA(i32) || a.isA(jsNumberPtr)) &&
        (b.isA(i32) || b.isA(jsNumberPtr))) {
      const numA = a.isA(i32) ? a : instr.loadUnboxed(a);
      const numB = b.isA(i32) ? b : instr.loadUnboxed(b);
      const numRes = instr.add(numA, numB);
      if (a.isA(jsNumberPtr) || b.isA(jsNumberPtr)) {
        const ptr = instr.malloc(jsNumber);
        instr.storeBoxed(ptr, numRes);
        return ptr;
      }
      return numRes;
    }

    // A mix of types.

    // TODO: find home.
    const toJsValue = (a: Value<any>): Pointer<JsUnknownType> => {
      if (a.isA(jsValuePtr)) {
        return instr.cast(a, jsValue);
      }
      if (a.isA(i32)) {
        const ptr = instr.malloc(jsNumber);
        instr.storeBoxed(ptr, a);
        return instr.cast(ptr, jsValue);
      }
      return values.jsNull;
    };

    const jsvA = toJsValue(a);
    const jsvB = toJsValue(b);
    return instr.call(funcs.addAny, {a: jsvA, b: jsvB});
  };
}

function addAnyFunctionFactory({instr, types, debug}: Gen, values: JslibValues) {
  const { i32, jsValue, jsNumber } = types;
  const jsValuePtr = jsValue.pointerOf();
  const jsNumberPtr = jsNumber.pointerOf();
  const funcType = types.func(
    jsValuePtr as PointerType<JsUnknownType2>,
    {
      a: jsValuePtr as PointerType<JsUnknownType2>,
      b: jsValuePtr as PointerType<JsUnknownType2>,
    }
  );
  const func = instr.func("jslib_add", funcType);

  instr.insertPoint(instr.block(func, 'entry'));

  const uptrA = func.arg("a");
  const uptrB = func.arg("b");

  // TODO: remove builder
  const jsTypeA = uptrA.type.toType.loadJsType(instr.builder, uptrA);
  const jsTypeB = uptrA.type.toType.loadJsType(instr.builder, uptrB);

  const isNumA = instr.icmpEq(jsTypeA, i32.constValue(JsType.NUMBER));
  const isNumB = instr.icmpEq(jsTypeB, i32.constValue(JsType.NUMBER));

  const num1Block = instr.block(func, 'num1');
  const num2Block = instr.block(func, 'num2');
  const unkBlock = instr.block(func, 'unk');

  instr.condBr(isNumA, num1Block, unkBlock);

  instr.insertPoint(num1Block);
  instr.condBr(isNumB, num2Block, unkBlock);

  instr.insertPoint(num2Block);

  const ptrA = instr.cast(uptrA, jsNumber);
  const ptrB = instr.cast(uptrB, jsNumber);

  const unboxedA = instr.loadUnboxed(ptrA);
  const unboxedB = instr.loadUnboxed(ptrB);

  const computedSum = instr.add(unboxedA, unboxedB);

  const ptrSum = instr.malloc(types.jsNumber);
  instr.storeBoxed(ptrSum, computedSum);

  instr.ret(func, instr.cast(ptrSum, jsValue));

  instr.insertPoint(unkBlock);

  // TODO: string, other types, toPrimitive, undefined.
  instr.ret(func, instr.cast(values.jsNull, jsValue));

  return func;
}
