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

#ifndef __JSNUMBER_H__
#define __JSNUMBER_H__

#include "jsvalue.h"

typedef struct JsNumber {
  // JsValue value = NUMBER
  enum JsType jsType;
  //
  // TODO: switch to double
  int value;
} JsNumber;

static const JsNumber JSZERO_VALUE = {.jsType = NUMBER, .value = 0};
static const JsNumber* JSZERO = &JSZERO_VALUE;

JsNumber* jsNumber_create(int value);

#endif
