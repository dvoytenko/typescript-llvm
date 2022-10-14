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
#include "jsvmap.h"
#include "jsvalue.h"
#include "jsstring.h"

JsvMap* jsvMap_create() {
  JsvMap* map = (JsvMap*) malloc(sizeof(JsvMap));
  map->length = 0;
  map->entries = (JsvMapEntry*) malloc(sizeof(JsvMapEntry) * 100);
  return map;
}

JsValue* jsvMap_getField(JsvMap* ptr, JsString* key) {
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
    return (JsValue*) JSNULL;
  }
  return ptr->entries[index].val;
}

void jsvMap_setField(JsvMap* ptr, JsString* key, JsValue* val) {
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
}
