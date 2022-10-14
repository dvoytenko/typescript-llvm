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
