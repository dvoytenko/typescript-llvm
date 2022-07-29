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

type AddAnyArgs = [a: PointerType<JsUnknownType2>, b: PointerType<JsUnknownType2>];

interface JslibFunctions {
  addAny: Function<PointerType<JsUnknownType2>, AddAnyArgs>;
}

interface AddInstr {
  (name: string, a: Value<I32Type>, b: Value<I32Type>): Value<I32Type>;
  (name: string, a: Pointer<JsNumberType>, b: Pointer<JsNumberType>): Pointer<JsNumberType>;
  (name: string, a: Value<any>, b: Value<any>): Pointer<JsUnknownType>;
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
  return (name: string, a: Value<any>, b: Value<any>): Value<any> => {
    // TODO: the rules are incomplete and mostly wrong.

    // Both values are numeric: the result is numeric.
    if ((a.isA(i32) || a.isA(jsNumberPtr)) &&
        (b.isA(i32) || b.isA(jsNumberPtr))) {
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

    // TODO: find home.
    const toJsValue = (a: Value<any>): Pointer<JsUnknownType> => {
      if (a.isA(jsValuePtr)) {
        return instr.cast(name, a, jsValue);
      }
      if (a.isA(i32)) {
        const ptr = instr.malloc(name, jsNumber);
        instr.storeBoxed(ptr, a);
        return instr.cast(name, ptr, jsValue);
      }
      return values.jsNull;
    };

    const jsvA = toJsValue(a);
    const jsvB = toJsValue(b);
    return instr.call(name, funcs.addAny, [jsvA, jsvB]);
  };
}

function addAnyFunctionFactory({instr, types, debug}: Gen, values: JslibValues) {
  const { i32, jsValue, jsNumber } = types;
  const jsValuePtr = jsValue.pointerOf();
  const jsNumberPtr = jsNumber.pointerOf();
  const funcType = types.func<PointerType<JsUnknownType2>, AddAnyArgs>(
    jsValuePtr as PointerType<JsUnknownType2>,
    [
      jsValuePtr as PointerType<JsUnknownType2>,
      jsValuePtr as PointerType<JsUnknownType2>,
    ]
  );
  const func = instr.func("jslib_add", funcType);

  instr.insertPoint(instr.block(func, 'entry'));

  const uptrA = func.args[0];
  const uptrB = func.args[1];

  // TODO: remove builder
  const jsTypeA = uptrA.type.toType.loadJsType(instr.builder, uptrA);
  const jsTypeB = uptrA.type.toType.loadJsType(instr.builder, uptrB);

  const isNumA = instr.icmpEq('is_num_a', jsTypeA, i32.constValue(JsType.NUMBER));
  const isNumB = instr.icmpEq('is_num_b', jsTypeB, i32.constValue(JsType.NUMBER));

  const num1Block = instr.block(func, 'num1');
  const num2Block = instr.block(func, 'num2');
  const unkBlock = instr.block(func, 'unk');

  instr.condBr(isNumA, num1Block, unkBlock);

  instr.insertPoint(num1Block);
  instr.condBr(isNumB, num2Block, unkBlock);

  instr.insertPoint(num2Block);

  const ptrA = instr.cast('jsn_a', uptrA, jsNumber);
  const ptrB = instr.cast('jsn_b', uptrB, jsNumber);

  const unboxedA = instr.loadUnboxed(ptrA);
  const unboxedB = instr.loadUnboxed(ptrB);

  const computedSum = instr.add('sum', unboxedA, unboxedB);

  const ptrSum = instr.malloc('jsn_sum', types.jsNumber);
  instr.storeBoxed(ptrSum, computedSum);

  instr.ret(func, instr.cast('sum_jsv', ptrSum, jsValue));

  instr.insertPoint(unkBlock);

  // TODO: string, other types, toPrimitive, undefined.
  instr.ret(func, instr.cast('jsv_null', values.jsNull, jsValue));

  return func;
}
