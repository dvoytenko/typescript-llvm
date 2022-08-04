#ifndef __JSOBJECT_H__
#define __JSOBJECT_H__

#include "jsvalue.h"
#include "jsvmap.h"
#include "vtable.h"

typedef struct JsObject {
  // JsValue:
  enum JsType jsType;
  // JsObject:
  VTable* vtable;
  JsvMap* map;
} JsObject;

void jsObject_init(JsObject* ptr, VTable* vtable);
JsValue* jsObject_getField(JsObject* ptr, JsString* key);
void jsObject_setField(JsObject* ptr, JsString* key, JsValue* val);

#endif
