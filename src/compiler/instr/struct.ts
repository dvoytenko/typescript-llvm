import llvm from "llvm-bindings";
import { Pointer, StructType, Value } from "../types";
import { LoadType } from "./load-store";
import { getName } from "./name";

export type GepStructFieldType = <
  T extends StructType<any>,
  F extends T extends StructType<infer F1> ? F1 : never,
  K extends keyof F
>(
  ptr: Pointer<T>,
  field: K
) => Pointer<F[K]>;

export type LoadStructFieldType = <
  T extends StructType<any>,
  F extends T extends StructType<infer F1> ? F1 : never,
  K extends keyof F
>(
  ptr: Pointer<T>,
  field: K
) => Value<F[K]>;

export function gepStructFieldFactory(
  builder: llvm.IRBuilder
): GepStructFieldType {
  return (ptr, field) => {
    const structType = ptr.type.toType;
    const fieldPtr = builder.CreateGEP(
      structType.llType,
      ptr.llValue,
      [
        builder.getInt32(0),
        builder.getInt32(structType.fieldNames.indexOf(field)),
      ],
      getName(`${structType.typeName}_${field as string}_ptr`)
    );
    const type = structType.fields[field];
    return new Pointer(type, fieldPtr);
  };
}

export function loadStructFieldFactory(
  builder: llvm.IRBuilder,
  gepStructField: GepStructFieldType,
  load: LoadType
) {
  return <
    T extends StructType<any>,
    F extends T extends StructType<infer F1> ? F1 : never,
    K extends keyof F
  >(
    ptr: Pointer<T>,
    field: K
  ): Value<F[K]> => {
    const fieldPtr = gepStructField(ptr, field);
    return load(field as string, fieldPtr);
  };
}
