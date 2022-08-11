import llvm from "llvm-bindings";
import { I64Type, Types, ConstValue, Type } from "../types";
import { getName } from "./name";

export type SizeofType = (type: Type) => ConstValue<I64Type>;

export function sizeofFactory(builder: llvm.IRBuilder, types: Types) {
  const { i64 } = types;
  return (type: Type): ConstValue<I64Type> => {
    const arrayType = llvm.PointerType.get(type.llType, 0);
    const gep = builder.CreateGEP(
      type.llType,
      llvm.Constant.getNullValue(arrayType),
      [builder.getInt32(1)],
      getName(`${type.typeName}_sizeof_ptr`)
    );
    const intVal = builder.CreatePtrToInt(
      gep,
      i64.llType,
      getName(`${type.typeName}_sizeof`)
    );
    return i64.constValue(intVal as llvm.Constant);
  };
}
