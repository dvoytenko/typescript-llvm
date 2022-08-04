#ifndef __VTABLE_H__
#define __VTABLE_H__

#include <stdbool.h>
#include "jsvalue.h"
#include "jsstring.h"
// #include "jsobject.h"

typedef struct JsObject JsObject;

typedef struct VTableField VTableField;

typedef struct VTableFields {
  int length;
  VTableField* fields;
} VTableFields;

typedef struct VTableField {
  JsString* field;
  enum JsType jsType;
  char boxed;
  int offset;
} VTableField;

typedef struct VTable {
  struct VTableFields fields;
} VTable;

JsValue* vTable_getField(JsObject* ptr, JsString* fieldName);
bool vTable_setField(JsObject* ptr, JsString* key, JsValue* val);

#endif
