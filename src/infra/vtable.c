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

#include <stdlib.h>
#include <stdio.h>
#include "vtable.h"
#include "jsvalue.h"
#include "jsobject.h"
#include "jsnumber.h"
#include "debug.h"

static const int JSOBJECT_SIZE = sizeof(JsObject);

JsValue* vTable_getField(JsObject* ptr, JsString* fieldName) {
  VTable* vtable = ptr->vtable;
  int length = vtable->fields.length;
  if (length == 0) {
    return NULL;
  }

  VTableField* fields = vtable->fields.fields;
  // TODO: fast search.
  int index = -1;
  for (int i = 0; i < length; i++) {
    if (jsString_equals(fields[i].field, fieldName)) {
      index = i;
      break;
    }
  }
  if (index == -1) {
    return NULL;
  }

  VTableField* field = &fields[index];

  // The `JsCustObject.cust` is right after all `JsObject` fields.
  void* cust = (void*) (&ptr[1]);
  void* fptr = cust + field->offset;

  // Boxed values are always pointers.
  if (field->boxed) {
    return ((JsValue**) fptr)[0];
  }

  enum JsType jsType = field->jsType;
  switch (jsType) {
    // These types are always boxed pointers.
    case ANY:
    case UNDEFINED:
    case NULLV:
    case STRING:
    case SYMBOL:
    case OBJECT:
      return ((JsValue**) fptr)[0];
    // Unboxed values.
    case NUMBER:
      return (JsValue*) jsNumber_create(((int*) fptr)[0]);
    case BOOL:
      // QQQ: support boolean valueOf()
      return (JsValue*) JSNULL;
    // Not sure.
    case FUNCTION:
    case ARRAY:
    case BIGINT:
      // TODO: implement all other types.
      return (JsValue*) JSUNDEF;
  }
  return (JsValue*) JSUNDEF;
}

bool vTable_setField(JsObject* ptr, JsString* key, JsValue* val) {
  /* QQQ
  int length = ptr->length;
  JsvMapEntry* entries = ptr->entries;
  int index = -1;
  for (int i = 0; i < length; i++) {
    if (jsString_equals(entries[i].key, key)) {
      index = i;
      break;
    }
  }
  if (index == -1) {
    int length = ptr->length;
    JsvMapEntry* entry = &ptr->entries[length];
    entry->key = key;
    entry->val = val;
    ptr->length = length + 1;
  } else {
    ptr->entries[index].val = val;
  }
  */
  return false;
}

VTableIfcField* vTable_getIfc(JsObject* ptr, int id) {
  VTable* vtable = ptr->vtable;
  int length = vtable->itable.length;
  if (length == 0) {
    return NULL;
  }

  VTableIfc* ifcs = vtable->itable.ifcs;
  // TODO: fast search.
  for (int i = 0; i < length; i++) {
    if (ifcs[i].id == id) {
      return ifcs[i].fields;
      break;
    }
  }
  return NULL;
}
