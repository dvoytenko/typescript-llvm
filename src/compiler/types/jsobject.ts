import llvm from "llvm-bindings";
import { Types } from ".";
import { Debug } from "../debug";
import { Instr } from "../instr";
import { JslibValues } from "../jslib";
import { Pointer } from "./base";
import { JsType, JsValueType } from "./jsvalue";
import { JsvMap, jsvMapHelperFactory } from "./jsvmap";

export class JsObject extends JsValueType<
  JsType.OBJECT,
  {
    // QQQQ: should be pointer to avoid reserving space when not used!!!
    map: JsvMap;
  }
> {
  constructor(context: llvm.LLVMContext, jsvMap: JsvMap) {
    super(context, JsType.OBJECT, { map: jsvMap });
  }

  constr(instr: Instr, types: Types, ptr: Pointer<typeof this>) {
    this.storePartialStruct(instr.builder, ptr, {
      jsType: types.i32.constValue(this.jsType),
    });
    // TODO: in reality it's known to be a non-pointer.
    const mapPtr = this.fields.map.isPointer()
      ? instr.malloc("f_map", this.fields.map.toType)
      : this.gep(instr.builder, ptr, "map");
    this.fields.map.constr(instr, types, mapPtr);
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
  values: JslibValues,
  mapHelper: ReturnType<typeof jsvMapHelperFactory>
): (ptr: Pointer<JsObject>) => JsObjectHelper {
  const { jsString, jsObject, jsvMap } = types;
  // TODO: switch to "open" conversion.
  const keyToString = (key: Pointer<JsValueType<any, any>>) =>
    instr.strictConvert(key, jsString.pointerOf());
  return (ptr: Pointer<JsObject>) => ({
    init() {
      // QQQQ: this should become part of constructor flow!!!
      jsObject.storePartialStruct(instr.builder, ptr, {
        jsType: types.i32.constValue(JsType.OBJECT),
      });
      const mapPtr = jsObject.gep(instr.builder, ptr, "map");
      const entriesPtr = jsvMap.gep(instr.builder, mapPtr, "entries");
      const entriesType = entriesPtr.type.toType;
      entriesType.initInst(instr, types, entriesPtr, 100);
    },
    getField(key: Pointer<JsValueType<any, any>>) {
      const mapPtr = ptr.type.toType.gep(instr.builder, ptr, "map");
      return mapHelper(mapPtr).get(keyToString(key));
    },
    setField(
      key: Pointer<JsValueType<any, any>>,
      value: Pointer<JsValueType<any, any>>
    ) {
      const mapPtr = ptr.type.toType.gep(instr.builder, ptr, "map");
      mapHelper(mapPtr).set(keyToString(key), value);
    },
  });
}
