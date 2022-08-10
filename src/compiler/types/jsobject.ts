import llvm from "llvm-bindings";
import { Pointer, PointerType } from "./base";
import { JsType, JsValue } from "./jsvalue";
import { JsvMap } from "./jsvmap";
import { StructFields, StructType } from "./struct";
import { VTable } from "./vtable";

export interface JsObjectFields extends StructFields {
  vtable: PointerType<VTable>;
  map: PointerType<JsvMap>;
  cust: StructType<any>;
}

export class JsObject extends JsValue<JsType.OBJECT, JsObjectFields> {
  constructor(
    context: llvm.LLVMContext,
    vtableType: VTable,
    jsvMap: JsvMap,
    name?: string,
    more?: StructFields
  ) {
    super(
      context,
      JsType.OBJECT,
      {
        vtable: vtableType.pointerOf(),
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
    vtableType: VTable,
    jsvMap: JsvMap,
    name: string,
    public cust: StructType<any>,
    public vtablePtr: Pointer<VTable>
  ) {
    super(context, vtableType, jsvMap, name, { cust });
  }
}
