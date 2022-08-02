import llvm from "llvm-bindings";
import { Types } from ".";
import { Debug } from "../debug";
import { Instr } from "../instr";
import { JslibValues } from "../jslib";
import { I32Type, Pointer, PointerType } from "./base";
import { JsString, jsStringHelperFactory } from "./jsstring";
import { JsUnknownType, JsValueType } from "./jsvalue";
import { NMutList } from "./nlist";
import { StructFields, StructType } from "./struct";

interface Fields extends StructFields {
  entries: NMutList<EntryType>;
}

export class JsvMap extends StructType<Fields> {
  constructor(
    context: llvm.LLVMContext,
    jsString: JsString,
    jsValue: JsValueType<any, any>
  ) {
    super(context, "JsvMap", {
      entries: new NMutList(context, new EntryType(context, jsString, jsValue)),
    });
  }

  constr(instr: Instr, types: Types, ptr: Pointer<typeof this>) {
    // TODO: in reality it's known to be a non-pointer.
    const entriesPtr = this.fields.entries.isPointer()
      ? instr.malloc("f_entries", this.fields.entries.toType)
      : this.gep(instr.builder, ptr, "entries");
    this.fields.entries.constr(instr, types, entriesPtr);
  }
}

interface EntryFields extends StructFields {
  key: PointerType<JsString>;
  value: PointerType<JsValueType<any, any>>;
}

class EntryType extends StructType<EntryFields> {
  constructor(
    context: llvm.LLVMContext,
    jsString: JsString,
    jsValue: JsValueType<any, any>
  ) {
    super(context, "JsvMap.Entry", {
      key: jsString.pointerOf(),
      value: jsValue.pointerOf(),
    });
  }
}

export interface JsvMapHelper {
  get(key: Pointer<JsString>): Pointer<JsValueType<any, any>>;
  set(key: Pointer<JsString>, value: Pointer<JsValueType<any, any>>);
}

export function jsvMapHelperFactory(
  types: Types,
  instr: Instr,
  debug: Debug,
  values: JslibValues,
  jsStringHelper: ReturnType<typeof jsStringHelperFactory>
): (ptr: Pointer<JsvMap>) => JsvMapHelper {
  const jsvMap = types.jsvMap;
  const get = getMapValueFactory(
    values,
    types,
    instr,
    debug,
    jsvMap,
    jsStringHelper
  );
  const set = setMapValueFactory(types, instr, debug, jsvMap, jsStringHelper);
  return (ptr: Pointer<JsvMap>) => ({
    get: (key: Pointer<JsString>) => get(ptr, key),
    set: (key: Pointer<JsString>, value: Pointer<JsValueType<any, any>>) =>
      set(ptr, key, value),
  });
}

function getMapValueFactory(
  values: JslibValues,
  types: Types,
  instr: Instr,
  debug: Debug,
  jsvMap: JsvMap,
  jsStringHelper: ReturnType<typeof jsStringHelperFactory>
) {
  const { jsValue } = types;
  const jsString = types.jsString;
  const jsStringPtr = jsString.pointerOf();
  // const jsStringHelper;
  const jsValuePtr = jsValue.pointerOf();
  const funcType = types.func<
    PointerType<JsUnknownType>,
    [PointerType<JsvMap>, PointerType<JsString>]
  >(jsValuePtr, [jsvMap.pointerOf(), jsStringPtr]);
  const func = instr.func("jslib/JsvMap/get", funcType);
  instr.insertPoint(instr.block(func, "entry"));

  const ptr = func.args[0];
  const keyPtr = func.args[1];
  const keyHelper = jsStringHelper(keyPtr);

  const entriesType = jsvMap.fields.entries;
  const entriesPtr = ptr.type.toType.gep(instr.builder, ptr, "entries");
  const index = entriesType.instrFindIndex(
    instr,
    types,
    debug,
    func,
    entriesPtr,
    (itemPtr: Pointer<EntryType>) => {
      const entryType = itemPtr.type.toType;
      const itemKeyPtr = entryType.load(instr.builder, itemPtr, "key");
      return keyHelper.equals(itemKeyPtr);
    }
  );

  const foundBlock = instr.block(func, "found");
  const notFoundBlock = instr.block(func, "notfound");
  const notFound = instr.icmpEq(
    "is_not_found",
    index,
    types.i32.constValue(-1)
  );
  instr.condBr(notFound, notFoundBlock, foundBlock);

  instr.insertPoint(foundBlock);
  const indexPtr = entriesType.itemGep(instr, "index_ptr", entriesPtr, index);
  const entryType = entriesType.itemType;
  const valuePtr = entryType.load(instr.builder, indexPtr, "value");
  instr.ret(func, valuePtr);

  instr.insertPoint(notFoundBlock);
  // TODO: must be actually undefined
  const nullAsUnk = instr.cast("cast", values.jsNull, jsValue);
  instr.ret(func, nullAsUnk);

  func.verify();

  return (ptr: Pointer<JsvMap>, key: Pointer<JsString>) => {
    return instr.call("get_map_field", func, [ptr, key]);
  };
}

function setMapValueFactory(
  types: Types,
  instr: Instr,
  debug: Debug,
  jsvMap: JsvMap,
  jsStringHelper: ReturnType<typeof jsStringHelperFactory>
) {
  const { jsValue } = types;
  const jsString = types.jsString;
  const jsStringPtr = jsString.pointerOf();
  const jsValuePtr = jsValue.pointerOf();
  const funcType = types.func<
    // TODO: VOID
    I32Type,
    [
      PointerType<JsvMap>,
      PointerType<JsString>,
      PointerType<JsValueType<any, any>>
    ]
  >(types.i32, [jsvMap.pointerOf(), jsStringPtr, jsValuePtr]);

  const func = instr.func("jslib/JsvMap/set", funcType);
  instr.insertPoint(instr.block(func, "entry"));

  const ptr = func.args[0];
  const keyPtr = func.args[1];
  const valuePtr = func.args[2];

  const keyHelper = jsStringHelper(keyPtr);

  const entriesType = jsvMap.fields.entries;
  const entriesPtr = ptr.type.toType.gep(instr.builder, ptr, "entries");
  const index = entriesType.instrFindIndex(
    instr,
    types,
    debug,
    func,
    entriesPtr,
    (itemPtr: Pointer<EntryType>) => {
      const entryType = itemPtr.type.toType;
      const itemKeyPtr = entryType.load(instr.builder, itemPtr, "key");
      return keyHelper.equals(itemKeyPtr);
    }
  );

  const foundBlock = instr.block(func, "found");
  const notFoundBlock = instr.block(func, "notfound");
  const notFound = instr.icmpEq(
    "is_not_found",
    index,
    types.i32.constValue(-1)
  );
  instr.condBr(notFound, notFoundBlock, foundBlock);

  instr.insertPoint(foundBlock);
  const indexPtr = entriesType.itemGep(instr, "index_ptr", entriesPtr, index);
  const entryType = entriesType.itemType;
  const valuePtrPtr = entryType.gep(instr.builder, indexPtr, "value");
  instr.store(valuePtrPtr, valuePtr);
  instr.ret(func, types.i32.constValue(0));

  instr.insertPoint(notFoundBlock);
  const newEntryPtr = entriesType.appendAlloc(
    instr,
    types,
    "new_entry_ptr",
    entriesPtr
  );
  entryType.storeStruct(instr.builder, newEntryPtr, {
    key: keyPtr,
    value: valuePtr,
  });
  instr.ret(func, types.i32.constValue(0));

  func.verify();

  return (
    ptr: Pointer<JsvMap>,
    key: Pointer<JsString>,
    value: Pointer<JsValueType<any, any>>
  ) => {
    instr.call("map_set", func, [ptr, key, value]);
  };
}
