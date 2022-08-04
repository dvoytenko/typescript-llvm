#include <stdio.h>
#include <stdlib.h>
#include "jsobject.h"
#include "jsvalue.h"
#include "jsvmap.h"
#include "vtable.h"
#include "debug.h"

void jsObject_init(JsObject* ptr, VTable* vtable) {
  ptr->jsType = OBJECT;
  ptr->vtable = vtable;
  ptr->map = NULL;
}

JsValue* jsObject_getField(JsObject* ptr, JsString* key) {
  JsValue* vtableField = vTable_getField(ptr, key);
  if (vtableField != NULL) {
    return vtableField;
  }

  if (!ptr->map) {
    return (JsValue*) JSNULL;
  }
  return jsvMap_getField(ptr->map, key);
}

void jsObject_setField(JsObject* ptr, JsString* key, JsValue* val) {
  if (vTable_setField(ptr, key, val)) {
    return;
  }

  if (!ptr->map) {
    ptr->map = jsvMap_create();
  }
  jsvMap_setField(ptr->map, key, val);
}
