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
import { BoxedType, ConstValue, Pointer, Value } from "./base";
import { I32Type } from "./inttype";
import { JsType, JsValue } from "./jsvalue";

export class JsNumber
  extends JsValue<
    JsType.NUMBER,
    {
      // TODO: switch to double
      value: I32Type;
    }
  >
  implements BoxedType<I32Type>
{
  public readonly unboxedType: I32Type;

  constructor(context: llvm.LLVMContext) {
    super(
      context,
      JsType.NUMBER,
      { value: new I32Type(context) },
      "struct.JsNumber"
    );
    this.unboxedType = new I32Type(context);
  }

  override constValue(v: number | llvm.Constant): ConstValue<typeof this> {
    return this.constStruct({
      jsType: this.fields.jsType.constValue(this.jsType),
      value: this.fields.value.constValue(v),
    });
  }

  // TODO: move to JsPrimitiveType?
  loadUnboxed(
    builder: llvm.IRBuilder,
    ptr: Pointer<typeof this>
  ): Value<I32Type> {
    return this.load(builder, ptr, "value");
  }

  // TODO: move to JsPrimitiveType?
  storeBoxed(
    builder: llvm.IRBuilder,
    ptr: Pointer<typeof this>,
    value: Value<I32Type>
  ) {
    this.storeStruct(builder, ptr, {
      jsType: this.fields.jsType.constValue(this.jsType),
      value,
    });
  }

  boxStore(
    builder: llvm.IRBuilder,
    ptr: Pointer<typeof this>,
    unboxed: Value<I32Type>
  ) {
    const i32 = new I32Type(this.context);
    this.storeStruct(builder, ptr, {
      jsType: new Value(i32, llvm.ConstantInt.get(i32.llType, this.jsType)),
      value: unboxed,
    });
  }

  box(unboxed: number | ConstValue<I32Type>): ConstValue<typeof this> {
    const i32 = new I32Type(this.context);
    if (typeof unboxed === "number") {
      unboxed = i32.constValue(unboxed);
    }
    return this.constStruct({
      jsType: i32.constValue(this.jsType),
      value: unboxed,
    });
  }
}
