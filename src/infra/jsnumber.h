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

JsNumber* jsNumber_create(int value);

#endif
