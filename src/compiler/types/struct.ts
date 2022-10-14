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
import { getName } from "../instr/name";
import { ConstValue, Pointer, Type, Value } from "./base";

export interface StructFields {
  [name: string]: Type;
}

export type StructValues<T extends StructFields> = {
  [name in keyof T]: Value<T[name]>;
};

export type StructConstValues<T extends StructFields> = {
  [name in keyof T]: ConstValue<T[name]>;
};

export class StructType<Fields extends StructFields> extends Type {
  public readonly fieldNames: (keyof Fields)[];

  constructor(
    context: llvm.LLVMContext,
    public readonly name: string,
    public readonly fields: Fields
  ) {
    super(
      context,
      llvm.StructType.create(
        context,
        Object.entries(fields).map(([, type]) => type.llType),
        name
      )
    );
    this.fieldNames = Object.entries(fields).map(([name]) => name);
  }

  override get typeName(): string {
    return this.name.toLowerCase();
  }

  constStruct(fields: StructConstValues<Fields>): ConstValue<typeof this> {
    const struct = llvm.ConstantStruct.get(
      // TODO: remove unneeded cast.
      this.llType as llvm.StructType,
      Object.entries(this.fields).map(([name]) => fields[name].llValue)
    );
    return super.constValue(struct);
  }

  // TODO: remove.
  private gep<F extends keyof Fields>(
    builder: llvm.IRBuilder,
    ptr: Pointer<typeof this>,
    field: F
  ): Pointer<Fields[F]> {
    const fieldPtr = builder.CreateGEP(
      this.llType,
      ptr.llValue,
      [
        builder.getInt32(0),
        builder.getInt32(this.fieldNames.indexOf(field as string)),
      ],
      getName(`${this.typeName}_${field as string}_ptr`)
    );
    const type = this.fields[field];
    return new Pointer(type, fieldPtr);
  }

  load<F extends keyof Fields>(
    builder: llvm.IRBuilder,
    ptr: Pointer<typeof this>,
    field: F
  ): Value<Fields[F]> {
    const type = this.fields[field];
    const fieldPtr = this.gep(builder, ptr, field);
    const value = builder.CreateLoad(
      type.llType,
      fieldPtr.llValue,
      getName(field as string)
    );
    return new Value<Fields[F]>(type, value);
  }

  store<F extends keyof Fields>(
    builder: llvm.IRBuilder,
    ptr: Pointer<typeof this>,
    field: F,
    value: Value<Fields[F]>
  ) {
    const fieldPtr = this.gep(builder, ptr, field);
    builder.CreateStore(value.llValue, fieldPtr.llValue);
  }

  storeStruct(
    builder: llvm.IRBuilder,
    ptr: Pointer<typeof this>,
    struct: StructValues<Fields>
  ) {
    this.storePartialStruct(builder, ptr, struct);
  }

  storePartialStruct(
    builder: llvm.IRBuilder,
    ptr: Pointer<typeof this>,
    struct: Partial<StructValues<Fields>>
  ) {
    for (const f of this.fieldNames) {
      if (struct[f] !== undefined) {
        this.store(builder, ptr, f, struct[f]!);
      }
    }
  }
}
