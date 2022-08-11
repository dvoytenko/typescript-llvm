import { Instr } from "../instr";
import { Pointer, PointerType, Value, VoidType } from "../types/base";
import { I32Type } from "../types/inttype";
import { JsCustObject, JsObject } from "../types/jsobject";
import { JsString } from "../types/jsstring";
import { JsValue } from "../types/jsvalue";
import { VTableIfcField } from "../types/vtable";
import { JslibValues } from "./values";

export interface JsObjectLib {
  create(jsType: JsCustObject): Pointer<JsCustObject>;
  getField(ptr: Pointer<JsObject>, key: Pointer<JsValue>): Pointer<JsValue>;
  setField(
    ptr: Pointer<JsObject>,
    key: Pointer<JsValue>,
    value: Pointer<JsValue>
  ): void;
  getIfc(ptr: Pointer<JsObject>, id: Value<I32Type>): Pointer<VTableIfcField>;
}

export function jsObjectFactory(
  instr: Instr,
  values: JslibValues
): JsObjectLib {
  const { types } = instr;
  const { voidType, jsValue, jsString, jsObject, vtable, vtableIfcField, i32 } =
    types;
  const jsStringPtr = jsString.pointerOf();
  const jsObjectPtr = jsObject.pointerOf();
  const jsValuePtr = jsValue.pointerOf();
  const vtablePtr = vtable.pointerOf();

  const keyToString = (key: Pointer<JsValue>) =>
    instr.strictConvert(key, types.jsString.pointerOf());

  const jsObject_init = instr.func(
    "jsObject_init",
    types.func(voidType, [jsObjectPtr, vtablePtr])
  );

  const jsObject_getField = instr.func(
    "jsObject_getField",
    types.func(jsValuePtr, [jsObjectPtr, jsStringPtr]),
    ["readonly"]
  );
  const jsObject_setField = instr.func<
    VoidType,
    [PointerType<JsObject>, PointerType<JsString>, PointerType<JsValue>]
  >(
    "jsObject_setField",
    types.func(voidType, [jsObjectPtr, jsStringPtr, jsValuePtr])
  );
  const vTable_getIfc = instr.func(
    "vTable_getIfc",
    types.func(vtableIfcField.pointerOf(), [jsObjectPtr, i32]),
    ["readonly"]
  );

  return {
    create(jsType: JsCustObject) {
      const ptr = instr.malloc("jso", jsType);
      const ptr0 = instr.strictConvert(ptr, jsObjectPtr);
      instr.callVoid(jsObject_init, [
        ptr0,
        jsType.vtablePtr ?? values.vtableEmpty,
      ]);
      // QQQQ: zeroinitializer for cust?
      return ptr;
    },
    getField(ptr: Pointer<JsObject>, key: Pointer<JsValue>) {
      const ptr0 = instr.strictConvert(ptr, jsObjectPtr);
      return instr.call("get_field", jsObject_getField, [
        ptr0,
        keyToString(key),
      ]);
    },
    setField(
      ptr: Pointer<JsObject>,
      key: Pointer<JsValue>,
      value: Pointer<JsValue>
    ) {
      const ptr0 = instr.strictConvert(ptr, jsObjectPtr);
      instr.callVoid(jsObject_setField, [ptr0, keyToString(key), value]);
    },
    getIfc(
      ptr: Pointer<JsObject>,
      id: Value<I32Type>
    ): Pointer<VTableIfcField> {
      const ptr0 = instr.strictConvert(ptr, jsObjectPtr);
      return instr.call("get_ifc", vTable_getIfc, [ptr0, id]);
    },
  };
}
