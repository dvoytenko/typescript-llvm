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
#include "arithm.h"
#include "jsvalue.h"
#include "jsnumber.h"
#include "debug.h"

JsValue* jsValue_add(JsValue* a, JsValue* b) {
  if (a->jsType == NUMBER && b->jsType == NUMBER) {
    JsNumber* an = (JsNumber *) a;
    JsNumber* bn = (JsNumber *) b;
    int sum = an->value + bn->value;
    return (JsValue*) jsNumber_create(sum);
  }

  // TODO: string, other types, toPrimitive, undefined.
  return (JsValue*) JSNULL;
}

JsNumber* jsValue_sub(JsValue* a, JsValue* b) {
  // printf("jsValue_sub: %s, %s\n", jsValue_debug(a), jsValue_debug(b));
  if (a->jsType == NUMBER && b->jsType == NUMBER) {
    JsNumber* an = (JsNumber *) a;
    JsNumber* bn = (JsNumber *) b;
    int sub = an->value - bn->value;
    JsNumber* res = jsNumber_create(sub);
    // printf("jsValue_sub: res: %s\n", jsValue_debug(res));
    return res;
  }

  // TODO: string, other types, toPrimitive, undefined.
  // printf("jsValue_sub: res: JSNULL\n");
  return (JsNumber*) JSZERO;
}
