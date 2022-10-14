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

import llvm from "llvm-bindings";
import { JsValue, Types, Type, Value } from "../types";
import { MallocType } from "./malloc";
import { loadUnboxedFactory, storeBoxedFactory } from "./load-store";
import { castPtrFactory } from "./cast";

export type StrictConvertType = <T extends Type>(
  value: Value,
  toType: T
) => Value<T>;

// TODO: seems more advanced than simple LL instructions. Move to jslib?
export function strictConvertFactory(
  builder: llvm.IRBuilder,
  types: Types,
  malloc: MallocType
) {
  const cast = castPtrFactory(builder);
  const loadUnboxed = loadUnboxedFactory(builder);
  const storeBoxed = storeBoxedFactory(builder);
  return <T extends Type>(value: Value, toType: T): Value<T> => {
    // Already the right type.
    if (value.isA(toType)) {
      return value;
    }

    // Custom JsObjects.
    // TODO: to complicated a formula. Maybe do JsCustObject?
    if (
      toType.isPointerTo(types.jsObject) &&
      value.isPointerToInherited(types.jsObject) &&
      value.isInheritedFrom(toType) &&
      value.type.typeName !== toType.typeName
    ) {
      return cast("cast", value, toType.toType) as unknown as Value<T>;
    }

    // Widen to parent type.
    // TODO: more canonical parent/child inheritence.
    if (
      toType.isPointerTo(types.jsValue) &&
      value.isPointerToInherited(JsValue)
    ) {
      return cast("cast", value, types.jsValue) as unknown as Value<T>;
    }

    // Narrow to child type.
    if (
      value.isPointerTo(types.jsValue) &&
      !toType.isPointerTo(types.jsValue) &&
      toType.isPointer() &&
      toType.isPointerTo(JsValue)
    ) {
      // TODO: check that typing is compatible via IR (jsType === 8 or throw).
      return cast("jsv_to_obj", value, toType.toType) as unknown as Value<T>;
    }

    // Unbox.
    if (
      !toType.isPointer() &&
      value.isPointerTo(JsValue) &&
      value.isBoxed() &&
      value.type.toType.unboxedType.isA(toType)
    ) {
      return loadUnboxed(value);
    }

    // Narrow and box.
    // TODO: make it more generic.
    if (toType.isA(types.jsValue.pointerOf()) && value.isA(types.i32)) {
      const jsn = malloc("jsn", types.jsNumber);
      storeBoxed(jsn, value);
      return cast("jsv", jsn, types.jsValue) as unknown as Value<T>;
    }

    // Narrow and unbox: ptr_jsv to i32.
    // TODO: make it more generic.
    if (toType.isA(types.i32) && value.isA(types.jsValue.pointerOf())) {
      const jsn = cast("to_jsn", value, types.jsNumber);
      return loadUnboxed(jsn);
    }

    // TODO: a more canonical BoxedType/etc concepts.
    throw new Error(
      `cannot do strict convert from ${value.type.typeName} to ${toType.typeName}`
    );
  };
}
