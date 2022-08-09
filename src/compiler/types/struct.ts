import llvm from "llvm-bindings";
import { Pointer, Type, Value } from "./base";

export interface StructFields {
  [name: string]: Type;
}

export type StructValues<T extends StructFields> = {
  [name in keyof T]: Value<T[name]>;
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

  createConst(fields: StructValues<Fields>): Value<typeof this> {
    const struct = llvm.ConstantStruct.get(
      // TODO: remove unneeded cast.
      this.llType as llvm.StructType,
      // TODO: figure out this cast.
      Object.entries(this.fields).map(
        ([name]) => fields[name].llValue as llvm.Constant
      )
    );
    return new Value(this, struct);
  }

  // QQQ: remove?
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
      `${this.typeName}_${field as string}_ptr`
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
      field as string
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
