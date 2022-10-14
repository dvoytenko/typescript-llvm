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

#ifndef __JSVMAP_H__
#define __JSVMAP_H__

#include "jsvalue.h"
#include "jsstring.h"

typedef struct JsvMapEntry JsvMapEntry;

typedef struct JsvMap {
  int length;
  JsvMapEntry* entries;
} JsvMap;

typedef struct JsvMapEntry {
  JsString* key;
  JsValue* val;
} JsvMapEntry;

JsvMap* jsvMap_create();
JsValue* jsvMap_getField(JsvMap* ptr, JsString* key);
void jsvMap_setField(JsvMap* ptr, JsString* key, JsValue* val);

#endif
