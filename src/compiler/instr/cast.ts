import llvm from "llvm-bindings";
import { Pointer, PointerType, Type } from "../types/base";
import { getName } from "./name";

export type CastPtrType = <T extends Type>(
  name: string,
  ptr: Pointer,
  toType: T
) => Pointer<T>;

export function castPtrFactory(builder: llvm.IRBuilder) {
  return <T extends Type>(name: string, ptr: Pointer<Type>, toType: T) => {
    const castPtr = builder.CreateBitCast(
      ptr.llValue,
      PointerType.of(toType).llType,
      getName(name)
    );
    return new Pointer(toType, castPtr);
  };
}
