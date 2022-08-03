#include <stdio.h>
#include <stdlib.h>
#include "jsobject.h"
#include "jsvmap.h"
#include "tostring.h"

void jsObject_init(JsObject* ptr) {
  ptr->jsType = OBJECT;
  ptr->map = NULL;
}

JsValue* jsObject_getField(JsObject* ptr, JsString* key) {
  printf("getField: HERE\n");
  printf("getField: %s\n", jsValue_toString((JsValue*) key));
  if (!ptr->map) {
    return NULL;
  }
  int length = ptr->map->length;
  JsvMapEntry* entries = ptr->map->entries;
  int index = -1;
  for (int i = 0; i < length; i++) {
    if (jsString_equals(entries[i].key, key)) {
      index = i;
      break;
    }
  }
  if (index == -1) {
    return NULL;
  }
  return ptr->map->entries[index].val;
}

void jsObject_setField(JsObject* ptr, JsString* key, JsValue* val) {
  int index = -1;
  if (!ptr->map) {
    ptr->map = (JsvMap*) malloc(sizeof(JsvMap));
    ptr->map->length = 0;
    ptr->map->entries = (JsvMapEntry*) malloc(sizeof(JsvMapEntry) * 100);
  } else {
    int length = ptr->map->length;
    JsvMapEntry* entries = ptr->map->entries;
    for (int i = 0; i < length; i++) {
      if (jsString_equals(entries[i].key, key)) {
        index = i;
        break;
      }
    }
  }
  if (index == -1) {
    int length = ptr->map->length;
    JsvMapEntry* entry = &ptr->map->entries[length];
    entry->key = key;
    entry->val = val;
    ptr->map->length = length + 1;
  } else {
    ptr->map->entries[index].val = val;
  }
}
