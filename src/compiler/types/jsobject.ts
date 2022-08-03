import llvm from "llvm-bindings";
import { Types } from ".";
import { Debug } from "../debug";
import { Instr } from "../instr";
import { JslibValues } from "../jslib";
import { I32Type, Pointer, PointerType } from "./base";
import { JsString } from "./jsstring";
import { JsType, JsUnknownType, JsValueType } from "./jsvalue";
import { JsvMap, jsvMapHelperFactory } from "./jsvmap";
import { StructType } from "./struct";

export class JsObject extends JsValueType<
  JsType.OBJECT,
  {
    // QQQQ: should be pointer to avoid reserving space when not used!!!
    map: PointerType<JsvMap>;
    cust: StructType<any>;
  }
> {
  constructor(
    context: llvm.LLVMContext,
    jsvMap: JsvMap,
    name?: string,
    public cust?: StructType<any>
  ) {
    super(
      context,
      JsType.OBJECT,
      {
        map: jsvMap.pointerOf(),
        cust: cust ?? new StructType(context, "None", {}),
      },
      name
    );
  }

  constr(instr: Instr, types: Types, ptr: Pointer<typeof this>) {
    this.storePartialStruct(instr.builder, ptr, {
      jsType: types.i32.constValue(this.jsType),
    });
    const mapPtr = instr.malloc("f_map", this.fields.map.toType);
    this.fields.map.toType.constr(instr, types, mapPtr);
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
  const { jsString, jsvMap } = types;
  // TODO: switch to "open" conversion.
  const keyToString = (key: Pointer<JsValueType<any, any>>) =>
    instr.strictConvert(key, jsString.pointerOf());

  const getField = getFieldFactory(
    instr,
    types,
    values,
    types.jsObject,
    mapHelper
  );
  const setField = setFieldFactory(
    instr,
    types,
    values,
    debug,
    types.jsObject,
    mapHelper
  );

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
  jsObject: JsObject,
  mapHelper: ReturnType<typeof jsvMapHelperFactory>
) {
  const { jsValue } = types;
  const jsString = types.jsString;
  const jsStringPtr = jsString.pointerOf();
  const jsValuePtr = jsValue.pointerOf();
  const funcType = types.func<
    PointerType<JsUnknownType>,
    [PointerType<JsObject>, PointerType<JsString>]
  >(jsValuePtr, [jsObject.pointerOf(), jsStringPtr]);
  const func = instr.func("jslib/JsObject/getField", funcType);
  instr.insertPoint(instr.block(func, "entry"));

  const ptr = func.args[0];
  const keyPtr = func.args[1];

  const noMap = instr.block(func, "no_map");
  const hasMap = instr.block(func, "has_map");

  const mapPtr = jsObject.load(instr.builder, ptr, "map");
  const isNull = instr.isNull(mapPtr);
  instr.condBr(isNull, noMap, hasMap);

  instr.insertPoint(noMap);
  instr.ret(func, instr.cast("to_jsv", values.jsNull, jsValue));

  instr.insertPoint(hasMap);
  instr.ret(func, mapHelper(mapPtr).get(keyPtr));

  func.verify();

  return (
    ptr: Pointer<JsObject>,
    key: Pointer<JsString>
  ): Pointer<JsValueType<any, any>> => {
    return instr.call("get_field", func, [ptr, key]);
  };

  /*QQQQ
  const { jsValue } = types;
  const jsString = types.jsString;
  const jsStringPtr = jsString.pointerOf();
  const jsValuePtr = jsValue.pointerOf();
  const funcType = types.func<
    PointerType<JsUnknownType>,
    [PointerType<JsObject>, PointerType<JsString>]
  >(jsValuePtr, [jsObject.pointerOf(), jsStringPtr]);
  const func = instr.func("jsObject_getField", funcType);

  return (
    ptr: Pointer<JsObject>,
    key: Pointer<JsString>
  ): Pointer<JsValueType<any, any>> => {
    return instr.call("get_field", func, [ptr, key]);
  };
  */
}

function setFieldFactory(
  instr: Instr,
  types: Types,
  values: JslibValues,
  debug: Debug,
  jsObject: JsObject,
  mapHelper: ReturnType<typeof jsvMapHelperFactory>
) {
  const { jsValue } = types;
  const jsString = types.jsString;
  const jsStringPtr = jsString.pointerOf();
  const jsValuePtr = jsValue.pointerOf();
  const funcType = types.func<
    I32Type,
    [
      PointerType<JsObject>,
      PointerType<JsString>,
      PointerType<JsValueType<any, any>>
    ]
  >(types.i32, [jsObject.pointerOf(), jsStringPtr, jsValuePtr]);
  const func = instr.func("jslib/JsObject/setField", funcType);
  instr.insertPoint(instr.block(func, "entry"));

  const ptr = func.args[0];
  const keyPtr = func.args[1];
  const valuePtr = func.args[2];

  const noMap = instr.block(func, "no_map");
  const hasMap = instr.block(func, "has_map");

  const mapPtr = jsObject.load(instr.builder, ptr, "map");
  const mapPtrPtr = instr.alloca("map_ptr_ptr", mapPtr.type);
  instr.store(mapPtrPtr, mapPtr);
  const isNull = instr.isNull(mapPtr);
  instr.condBr(isNull, noMap, hasMap);

  instr.insertPoint(noMap);
  const mapType = jsObject.fields.map.toType;
  const newMapPtr = instr.malloc("map_ptr", mapType);
  instr.store(mapPtrPtr, newMapPtr);
  jsObject.storePartialStruct(instr.builder, ptr, {
    map: newMapPtr,
  });
  const entriesPtr = mapType.gep(instr.builder, newMapPtr, "entries");
  const entriesType = entriesPtr.type.toType;
  entriesType.initInst(instr, types, entriesPtr, 100);
  instr.br(hasMap);

  instr.insertPoint(hasMap);
  const updatedMapPtr = instr.load("upd_map_ptr", mapPtrPtr);
  mapHelper(updatedMapPtr).set(keyPtr, valuePtr);
  instr.ret(func, types.i32.constValue(0));

  func.verify();

  return (
    ptr: Pointer<JsObject>,
    key: Pointer<JsString>,
    value: Pointer<JsValueType<any, any>>
  ) => {
    instr.call("set_field", func, [ptr, key, value]);
  };

  /*QQQQ
  const { jsValue } = types;
  const jsString = types.jsString;
  const jsStringPtr = jsString.pointerOf();
  const jsValuePtr = jsValue.pointerOf();
  const funcType = types.func<
    I32Type,
    [
      PointerType<JsObject>,
      PointerType<JsString>,
      PointerType<JsValueType<any, any>>
    ]
  >(types.i32, [jsObject.pointerOf(), jsStringPtr, jsValuePtr]);
  const func = instr.func("jsObject_setField", funcType);

  return (
    ptr: Pointer<JsObject>,
    key: Pointer<JsString>,
    value: Pointer<JsValueType<any, any>>
  ) => {
    instr.call("set_field", func, [ptr, key, value]);
  };
  */
}
