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
#include <stdbool.h>
#include "jsstring.h"

JsString* jsString_create(int length, char* chars) {
  JsString* ptr = (JsString*) malloc(sizeof(JsString));
  jsString_init(ptr, length, chars);
  return ptr;
}

void jsString_init(JsString* ptr, int length, char* chars) {
  ptr->jsType = STRING;
  ptr->length = length;
  ptr->chars = chars;
}

bool jsString_equals(JsString* s1, JsString* s2) {
  if (s1 == s2) {
    return true;
  }
  if (s1->length != s2->length) {
    return false;
  }
  for (int i = 0; i < s1->length; i++) {
    if (s1->chars[i] != s2->chars[i]) {
      return false;
    }
  }
  return true;
}
