import llvm from "llvm-bindings";
import { I32Type, Pointer, Type, Value } from "../types";
import { getName } from "./name";

export type AllocaType = <T extends Type>(
  name: string,
  type: T,
  arraySize?: Value<I32Type> | null
) => Pointer<T>;

export function allocaFactory(builder: llvm.IRBuilder) {
  return <T extends Type>(
    name: string,
    type: T,
    arraySize?: Value<I32Type> | null
  ) => {
    const ptr = builder.CreateAlloca(
      type.llType,
      arraySize?.llValue ?? null,
      getName(name)
    );
    return new Pointer(type, ptr);
  };
}
