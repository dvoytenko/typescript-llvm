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
