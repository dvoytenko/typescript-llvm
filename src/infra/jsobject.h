#ifndef __JSOBJECT_H__
#define __JSOBJECT_H__

#include "jsvalue.h"
#include "jsvmap.h"

typedef struct JsObject {
  // JsValue value;
  enum JsType jsType;
  // 
  JsvMap* map;
} JsObject;

void jsObject_init(JsObject* ptr);
JsValue* jsObject_getField(JsObject* ptr, JsString* key);
void jsObject_setField(JsObject* ptr, JsString* key, JsValue* val);

#endif
