#ifndef __JSSTRING_H__
#define __JSSTRING_H__

#include <stdbool.h>
#include "jsvalue.h"

typedef struct JsString {
  // JsValue value;
  enum JsType jsType;
  //
  int length;
  // TODO: switch to i16.
  char* chars;
} JsString;

void jsString_init(JsString* ptr, int length, char* chars);
bool jsString_equals(JsString* s1, JsString* s2);

#endif
