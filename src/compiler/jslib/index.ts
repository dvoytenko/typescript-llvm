import llvm from 'llvm-bindings';
import { Debug } from '../debug';
import { Instr } from '../instr';
import { Function } from '../instr/func';
import { Types } from '../types';
import { Pointer, PointerType, Value } from '../types/base';
import { JsNullType } from '../types/jsnull';
import { JsNumberType } from '../types/jsnumber';
import { JsType, JsUnknownType, JsUnknownType2, JsValueType } from '../types/jsvalue';

export interface Jslib {
  jsNull: Pointer<JsNullType>,
  add: Function<PointerType<JsUnknownType2>, {a: PointerType<JsUnknownType2>, b: PointerType<JsUnknownType2>}>;
}

export interface Gen {
  instr: Instr;
  types: Types;
  debug: Debug;
}

export function jslibFactory(gen: Gen): Jslib {
  const i32 = gen.types.i32;
  const jsNull = gen.instr.globalConstVar("jsnull", gen.types.jsNull.createConst({jsType: i32.constValue(JsType.NULL)})).ptr;
  return {
    jsNull,
    add: addFactory(gen, jsNull),
  };
}

function addFactory({instr, types, debug}: Gen, jsNull: Pointer<JsNullType>) {
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

  // QQQ: remove builder
  // uptrA.type.castSub
  const jsTypeA = uptrA.type.toType.loadJsType(instr.builder, uptrA);
  const jsTypeB = uptrA.type.toType.loadJsType(instr.builder, uptrB);
  debug.printf("jsTypes = %d, %d", [jsTypeA, jsTypeB]);

  const isNumA = instr.icmpEq(jsTypeA, i32.constValue(JsType.NUMBER));
  const isNumB = instr.icmpEq(jsTypeB, i32.constValue(JsType.NUMBER));
  debug.printf("isNum = %d, %d", [isNumA, isNumB]);
  // const jsTypeTypeA = types.jsType(jsTypeA);
  // instr.load(.gep("jsType"));
  // return this.builder.CreateICmpEQ(left, right);

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
  instr.ret(func, instr.cast(jsNull, jsValue));

  return func;
}
