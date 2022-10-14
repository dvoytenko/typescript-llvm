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

import { Instr } from "../instr";
import { Function } from "../instr/func";
import { I32Type, JsNumber, JsValue, Pointer } from "../types";
import { PointerType, Value } from "../types";

export type AddAnyArgs = [a: PointerType<JsValue>, b: PointerType<JsValue>];

export type AddAnyType = Function<PointerType<JsValue>, AddAnyArgs>;

export type SubAnyArgs = AddAnyArgs;

export type SubAnyType = Function<PointerType<JsValue>, SubAnyArgs>;

export interface AddInstr {
  (name: string, a: Value<I32Type>, b: Value<I32Type>): Value<I32Type>;
  (name: string, a: Pointer<JsNumber>, b: Pointer<JsNumber>): Pointer<JsNumber>;
  (name: string, a: Value, b: Value): Pointer<JsValue>;
}

export type SubInstr = AddInstr;

export function addAnyFunctionFactory(instr: Instr) {
  const { types } = instr;
  const { jsValue } = types;
  const jsValuePtr = jsValue.pointerOf();
  const func = instr.func(
    "jsValue_add",
    types.func<PointerType<JsValue>, AddAnyArgs>(jsValuePtr, [
      jsValuePtr,
      jsValuePtr,
    ]),
    ["readonly"]
  );
  return func;
}

export function subAnyFunctionFactory(instr: Instr) {
  const { types } = instr;
  const { jsValue } = types;
  const jsValuePtr = jsValue.pointerOf();
  return instr.func(
    "jsValue_sub",
    types.func<PointerType<JsValue>, SubAnyArgs>(jsValuePtr, [
      jsValuePtr,
      jsValuePtr,
    ]),
    ["readonly"]
  );
}

export function addFactory(instr: Instr, addAny: AddAnyType): AddInstr {
  const { types } = instr;
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
    return instr.call(name, addAny, [jsvA, jsvB]);
  };
}

export function subFactory(instr: Instr, subAny: SubAnyType): SubInstr {
  const { types } = instr;
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
    return instr.call(name, subAny, [jsvA, jsvB]);
  };
}
