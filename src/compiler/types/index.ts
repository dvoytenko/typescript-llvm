import llvm from 'llvm-bindings';
import { I32Type, I64Type, I8Type, PointerType, Type, Value } from './base';
import { BoolType } from './bool';
import { FunctionArgs, FunctionType } from './func';
import { JsNullType } from './jsnull';
import { JsNumberType } from './jsnumber';
import { JsUnknownType, JsValueType } from './jsvalue';
import { StructFields, StructType } from './struct';

export interface Types {
  context: llvm.LLVMContext;
  i8: I8Type;
  i32: I32Type;
  i64: I64Type;
  bool: BoolType;
  pointer: <T extends Type>(type: T) => PointerType<T>,
  struct: <Fields extends StructFields>(name: string, fields: Fields) => StructType<Fields>;
  func: <Ret extends Type, Args extends FunctionArgs>(retType: Ret, args: Args) => FunctionType<Ret, Args>;
  jsValue: JsUnknownType;
  jsNull: JsNullType;
  jsNumber: JsNumberType;
}

export function types(context: llvm.LLVMContext): Types {
  // TODO: singleton
  return {
    context,
    i8: new I8Type(context),
    i32: new I32Type(context),
    i64: new I64Type(context),
    bool: new BoolType(context),
    pointer: <T extends Type>(type: T) => PointerType.of(type),
    struct: <Fields extends StructFields>(name: string, fields: Fields) => new StructType(context, name, fields),
    func: <Ret extends Type, Args extends FunctionArgs>(retType: Ret, args: Args) => new FunctionType(context, retType, args),
    jsValue: new JsUnknownType(context),
    jsNull: new JsNullType(context),
    jsNumber: new JsNumberType(context),
  };
}
