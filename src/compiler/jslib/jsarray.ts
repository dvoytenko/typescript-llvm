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
import { Pointer, Type } from "../types/base";
import { JsArray } from "../types/jsarray";

export interface JsArrayLib {
  createWithValues(values: Pointer<Type>[]): Pointer<JsArray>;
}

export function jsArrayFactory(instr: Instr): JsArrayLib {
  const { types } = instr;
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
