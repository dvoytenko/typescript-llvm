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
  // VTableFields* fields = &vtable->fields;
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
  void* cust = ((void*) ptr) + JSOBJECT_SIZE;
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