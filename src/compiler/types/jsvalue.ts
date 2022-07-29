import llvm from 'llvm-bindings';
import {I32Type, Pointer, PointerType, Type, Value} from './base';
import { StructFields, StructType } from './struct';

export enum JsType {
  UNKNOWN = -1,
  UDNEFINED = 0,
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

export abstract class JsValueType<JST extends JsType, Fields extends StructFields>
    extends StructType<JsTypeFields & Fields> {
  constructor(
    context: llvm.LLVMContext,
    public readonly jsType: JST,
    fields: Fields) {
    super(
      context,
      `JSV${jsType !== JsType.UNKNOWN ? jsType : ''}`,
      {
        jsType: new I32Type(context),
        ...fields,
      }
    );
  }

  castFrom(value: Pointer<JsValueType<any, any>>): Pointer<typeof this> {
    const valueJsType = value.type.toType.jsType;
    if (valueJsType !== JsType.UNKNOWN &&
        this.jsType !== JsType.UNKNOWN &&
        valueJsType !== this.jsType) {
      throw new Error(`Cannot convert ${valueJsType} to ${this.jsType}`);
    }
    return new Pointer(this, value.llValue);
  }

  loadJsType(builder: llvm.IRBuilder, ptr: Pointer<typeof this>): Value<I32Type> {
    return this.load(builder, ptr, "jsType");
  }
}

export type JsUnknownType2 = JsValueType<any, {}>;

export class JsUnknownType extends JsValueType<any, {}> {
  constructor(context: llvm.LLVMContext) {
    super(context, JsType.UNKNOWN, {});
  }
}