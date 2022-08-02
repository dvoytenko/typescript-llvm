import llvm from "llvm-bindings";
import { Types } from ".";
import { Instr } from "../instr";
import { I8Type, Pointer, PointerType, Value } from "./base";
import { BoolType } from "./bool";
import { JsType, JsValueType } from "./jsvalue";
import { NList } from "./nlist";

export class JsString extends JsValueType<
  JsType.STRING,
  {
    // TODO: switch to i16
    chars: NList<I8Type>;
  }
> {
  constructor(context: llvm.LLVMContext) {
    super(context, JsType.STRING, {
      chars: new NList(context, new I8Type(context)),
    });
  }

  constValue(instr: Instr, s: string): Value<typeof this> {
    // TODO: all of these is wrong!
    const len = s.length;
    const ptr = instr.globalStringPtr("jss", s);
    return this.createConst({
      jsType: this.fields.jsType.constValue(this.jsType),
      chars: this.fields.chars.constValue(len, ptr),
    });
  }
}

export interface JsStringHelper {
  equals: (other: Pointer<JsString>) => Value<BoolType>;
}

export function jsStringHelperFactory(
  types: Types,
  instr: Instr
): (ptr: Pointer<JsString>) => JsStringHelper {
  const jsString = types.jsString;
  const equalsFunc = stringEqualsFactory(types, instr, jsString);
  return (ptr: Pointer<JsString>) => ({
    equals: (other: Pointer<JsString>) => {
      return instr.call("str_eq", equalsFunc, [ptr, other]);
    },
  });
}

function stringEqualsFactory(types: Types, instr: Instr, jsString: JsString) {
  const { bool } = types;
  const jsStringPtr = jsString.pointerOf();
  const funcType = types.func<
    BoolType,
    [PointerType<JsString>, PointerType<JsString>]
  >(bool, [jsStringPtr, jsStringPtr]);
  const func = instr.func("jslib/JsString/equals", funcType);
  instr.insertPoint(instr.block(func, "entry"));

  const str1Ptr = func.args[0];
  const str2Ptr = func.args[1];

  const listType = jsString.fields.chars;
  const list1Ptr = jsString.gep(instr.builder, str1Ptr, "chars");
  const list2Ptr = jsString.gep(instr.builder, str2Ptr, "chars");

  const eq = listType.instrEquals(
    instr,
    types,
    func,
    list1Ptr,
    list2Ptr,
    (item1, item2) => instr.icmpEq("eq", item1, item2)
  );
  instr.ret(func, eq);

  func.verify();
  return func;
}
