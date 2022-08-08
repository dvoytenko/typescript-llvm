#ifndef __JSARRAY_H__
#define __JSARRAY_H__

#include "jsvalue.h"

typedef struct JsArray {
  // JsValue:
  enum JsType jsType;
  // JsArray:
  int length;
  JsValue** arr;
} JsArray;

#endif
