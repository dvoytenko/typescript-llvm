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

#include "stricteq.h"
#include "jsvalue.h"
#include "jsstring.h"

bool jsValue_strictEq(JsValue* v1, JsValue* v2) {
  if (v1 == v2) {
    return true;
  }

  // Different types.
  if (v1->jsType != v2->jsType) {
    return false;
  }

  if (v1->jsType == STRING) {
    return jsString_equals((JsString*) v1, (JsString*) v2);
  }

  // TODO: string, other types, toBoolean, undefined.
  return false;
}
