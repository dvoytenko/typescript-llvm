import llvm from "llvm-bindings";
import { IntType, Pointer, Type, Value } from "../types";
import { getName } from "./name";

export type GepArrayType = <T extends Type>(
  name: string,
  ptr: Pointer<T>,
  index: Value<IntType<any>>
) => Pointer<T>;

export function gepArrayFactory(builder: llvm.IRBuilder) {
  return <T extends Type>(
    name: string,
    ptr: Pointer<T>,
    index: Value<IntType<any>>
  ): Pointer<T> => {
    return new Pointer(
      ptr.type.toType,
      builder.CreateGEP(
        ptr.type.toType.llType,
        ptr.llValue,
        [index.llValue],
        getName(name)
      )
    );
  };
}
