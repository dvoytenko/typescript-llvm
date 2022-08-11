import { Pointer } from "../types";
import { JsNull } from "../types/jsnull";
import { JsNumber } from "../types/jsnumber";
import { JsCustObject } from "../types/jsobject";
import { VTable } from "../types/vtable";

export interface JslibValues {
  jsNull: Pointer<JsNull>;
  zero: Pointer<JsNumber>;
  vtableEmpty: Pointer<VTable>;
  jsEmptyObject: JsCustObject;
}
