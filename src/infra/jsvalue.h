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

#ifndef __JSVALUE_H__
#define __JSVALUE_H__

enum JsType {
  ANY = -1,
  UNDEFINED = 0,
  NULLV,
  BOOL,
  NUMBER,
  STRING,
  SYMBOL,
  FUNCTION,
  ARRAY,
  OBJECT,
  BIGINT,
  // Extensions?
  // INT32,
  // UINT32,
  // DATE,
  // REGEXP,
  // ERROR,
};

typedef struct JsValue {
  enum JsType jsType;
} JsValue;

static const JsValue JSNULL_VALUE = {.jsType = NULLV};
static const JsValue* JSNULL = &JSNULL_VALUE;

static const JsValue JSUNDEF_VALUE = {.jsType = UNDEFINED};
static const JsValue* JSUNDEF = &JSUNDEF_VALUE;

#endif
