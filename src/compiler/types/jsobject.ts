import llvm from "llvm-bindings";
import { Types } from ".";
import { Debug } from "../debug";
import { Instr } from "../instr";
import { JslibValues } from "../jslib";
import { I32Type, Pointer, PointerType } from "./base";
import { JsString } from "./jsstring";
import { JsType, JsUnknownType, JsValueType } from "./jsvalue";
import { JsvMap } from "./jsvmap";
import { StructFields, StructType } from "./struct";

export interface JsObjectFields extends StructFields {
  map: PointerType<JsvMap>;
  cust: StructType<any>;
}

export class JsObject extends JsValueType<JsType.OBJECT, JsObjectFields> {
  constructor(
    context: llvm.LLVMContext,
    jsvMap: JsvMap,
    name?: string,
    more?: StructFields
  ) {
    super(
      context,
      JsType.OBJECT,
      {
        map: jsvMap.pointerOf(),
        ...more,
      } as JsObjectFields,
      name ?? "struct.JsObject"
    );
  }
}

export class JsCustObject extends JsObject {
  constructor(
    context: llvm.LLVMContext,
    jsvMap: JsvMap,
    name: string,
    public cust: StructType<any>
  ) {
    super(context, jsvMap, name, { cust });
  }
}

export interface JsObjectHelper {
  // QQQ: change how construction is done!?
  init(): void;
  getField(key: Pointer<JsValueType<any, any>>): Pointer<JsValueType<any, any>>;
  setField(
    key: Pointer<JsValueType<any, any>>,
    value: Pointer<JsValueType<any, any>>
  ): void;
}

export function jsObjectHelperFactory(
  types: Types,
  instr: Instr,
  debug: Debug,
  values: JslibValues
): (ptr: Pointer<JsObject>) => JsObjectHelper {
  const { jsString, jsvMap } = types;
  // TODO: switch to "open" conversion.
  const keyToString = (key: Pointer<JsValueType<any, any>>) =>
    instr.strictConvert(key, jsString.pointerOf());

  const getField = getFieldFactory(instr, types, values, types.jsObject);
  const setField = setFieldFactory(instr, types, values, debug, types.jsObject);

  return (ptr: Pointer<JsObject>) => ({
    init() {
      // const ptr = instr.strictConvert(ptr0, jsObject.pointerOf());
      const jsObject = ptr.type.toType;
      // QQQ: this should become part of constructor flow!!!
      jsObject.storePartialStruct(instr.builder, ptr, {
        jsType: types.i32.constValue(JsType.OBJECT),
        map: jsvMap.pointerOf().nullptr(),
      });
    },
    getField(key: Pointer<JsValueType<any, any>>) {
      const ptr0 = instr.strictConvert(ptr, types.jsObject.pointerOf());
      return getField(ptr0, keyToString(key));
    },
    setField(
      key: Pointer<JsValueType<any, any>>,
      value: Pointer<JsValueType<any, any>>
    ) {
      const ptr0 = instr.strictConvert(ptr, types.jsObject.pointerOf());
      setField(ptr0, keyToString(key), value);
    },
  });
}

function getFieldFactory(
  instr: Instr,
  types: Types,
  values: JslibValues,
  jsObject: JsObject
) {
  const { jsValue } = types;
  const jsString = types.jsString;
  const jsStringPtr = jsString.pointerOf();
  const jsValuePtr = jsValue.pointerOf();
  const func = instr.func(
    "jsObject_getField",
    types.func<
      PointerType<JsUnknownType>,
      [PointerType<JsObject>, PointerType<JsString>]
    >(jsValuePtr, [jsObject.pointerOf(), jsStringPtr])
  );

  return (
    ptr: Pointer<JsObject>,
    key: Pointer<JsString>
  ): Pointer<JsValueType<any, any>> => {
    return instr.call("get_field", func, [ptr, key]);
  };
}

function setFieldFactory(
  instr: Instr,
  types: Types,
  values: JslibValues,
  debug: Debug,
  jsObject: JsObject
) {
  const { jsValue } = types;
  const jsString = types.jsString;
  const jsStringPtr = jsString.pointerOf();
  const jsValuePtr = jsValue.pointerOf();
  const func = instr.func(
    "jsObject_setField",
    types.func<
      I32Type,
      [
        PointerType<JsObject>,
        PointerType<JsString>,
        PointerType<JsValueType<any, any>>
      ]
    >(types.i32, [jsObject.pointerOf(), jsStringPtr, jsValuePtr])
  );

  return (
    ptr: Pointer<JsObject>,
    key: Pointer<JsString>,
    value: Pointer<JsValueType<any, any>>
  ) => {
    instr.call("set_field", func, [ptr, key, value]);
  };
}
