import llvm from "llvm-bindings";
import { I32Type } from "./inttype";
import { StructFields, StructType } from "./struct";

// TODO: move to jslib

export enum JsType {
  UNKNOWN = -1,
  UNDEFINED = 0,
  NULL,
  BOOL,
  NUMBER,
  STRING,
  SYMBOL,
  FUNCTION,
  ARRAY,
  OBJECT,
  BIGINT,
  // Extensions?
  // INT32,
  // UINT32,
  // DATE,
  // REGEXP,
  // ERROR,
}

interface JsTypeFields extends StructFields {
  jsType: I32Type;
}

export class JsValue<
  JST extends JsType = any,
  Fields extends StructFields = {}
> extends StructType<JsTypeFields & Fields> {
  constructor(
    context: llvm.LLVMContext,
    public readonly jsType: JST,
    fields: Fields,
    name?: string
  ) {
    super(
      context,
      name ?? `struct.JsValue${jsType !== JsType.UNKNOWN ? jsType : ""}`,
      {
        jsType: new I32Type(context),
        ...fields,
      }
    );
  }

  // QQQQ
  // loadJsType(
  //   builder: llvm.IRBuilder,
  //   ptr: Pointer<typeof this>
  // ): Value<I32Type> {
  //   return this.load(builder, ptr, "jsType");
  // }
}
