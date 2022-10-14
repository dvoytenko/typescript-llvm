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
