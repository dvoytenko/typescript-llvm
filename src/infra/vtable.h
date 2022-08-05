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

typedef struct VTableIfcField {
  enum JsType jsType;
  char boxed;
  int offset;
} VTableIfcField;

typedef struct VTableIfc {
  int id;
  VTableIfcField* fields;
} VTableIfc;

typedef struct VTableITable {
  int autoId;
  int length;
  VTableIfc* ifcs;
} VTableIfcs;

typedef struct VTable {
  struct VTableFields fields;
  struct VTableITable itable;
} VTable;

JsValue* vTable_getField(JsObject* ptr, JsString* fieldName);
bool vTable_setField(JsObject* ptr, JsString* key, JsValue* val);

VTableIfcField* vTable_getIfc(JsObject* ptr, int id);

#endif
