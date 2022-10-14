/*
Copyright 2022 Google LLC

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    https://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

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
