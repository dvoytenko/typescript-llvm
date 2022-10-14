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
import { JsValue } from "../types";
import { PointerType, Value } from "../types/base";
import { BoolType } from "../types/bool";

export type StictEqAnyArgs = [a: PointerType<JsValue>, b: PointerType<JsValue>];

export type StrictEqFunction = Function<BoolType, StictEqAnyArgs>;

export interface StrictEqInstr {
  (name: string, a: Value, b: Value): Value<BoolType>;
}

export function strictEqAnyFunctionFactory(instr: Instr) {
  const { types } = instr;
  const { bool, jsValue } = types;
  const jsValuePtr = jsValue.pointerOf();
  return instr.func(
    "jsValue_strictEq",
    types.func<BoolType, StictEqAnyArgs>(bool, [jsValuePtr, jsValuePtr]),
    ["readonly"]
  );
}

export function strictEqFactory(
  instr: Instr,
  strictEqAny: StrictEqFunction
): StrictEqInstr {
  const { types } = instr;
  const { i32, bool, jsNull, jsNumber, jsValue } = types;
  const jsNullPtr = jsNull.pointerOf();
  const jsNumberPtr = jsNumber.pointerOf();
  const jsValuePtr = jsValue.pointerOf();
  return (name: string, a: Value, b: Value): Value<BoolType> => {
    // TODO: the rules are incomplete and mostly wrong.
    // Both values are nulls: equality is confirmed.
    if (a.isA(jsNullPtr) && b.isA(jsNullPtr)) {
      return bool.constValue(true);
    }

    // One value is null (`a === null`): check whether the other one is too.
    if (a.isA(jsNullPtr) || b.isA(jsNullPtr)) {
      const other = instr.strictConvert(a.isA(jsNullPtr) ? b : a, jsValuePtr);
      const otherJsType = instr.loadStructField(other, "jsType");
      return instr.icmpEq(name, otherJsType, i32.constValue(jsNull.jsType));
    }

    // Both values are numeric: compare numbers.
    if (
      (a.isA(i32) || a.isA(jsNumberPtr)) &&
      (b.isA(i32) || b.isA(jsNumberPtr))
    ) {
      const numA = a.isA(i32) ? a : instr.loadUnboxed(a);
      const numB = b.isA(i32) ? b : instr.loadUnboxed(b);
      return instr.icmpEq(name, numA, numB);
    }

    // A mix of types.
    const jsvA = instr.strictConvert(a, jsValuePtr);
    const jsvB = instr.strictConvert(b, jsValuePtr);
    return instr.call(name, strictEqAny, [jsvA, jsvB]);
  };
}
