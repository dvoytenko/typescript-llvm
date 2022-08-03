#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "jsnumber.h"
#include "jsvalue.h"
#include "jsobject.h"
#include "jsstring.h"
#include "jsvmap.h"

char* jsNumber_debug(JsNumber* arg);
char* jsString_debug(JsString* arg);

char* jsValue_debug(JsValue* arg) {
  if (!arg) {
    return "NULL";
  }
  switch (arg->jsType) {
    case UDNEFINED:
      return "JSV<undefined>";
    case NULLV:
      return "JSV<null>";
    case BOOL:
      return "JSV<bool ?>";
    case NUMBER:
      return jsNumber_debug((JsNumber*) arg);
    case STRING:
      return jsString_debug((JsString*) arg);
    case SYMBOL:
      return "JSV<symbol ?>";
    case FUNCTION:
      return "JSV<func ?>";
    case ARRAY:
      return "JSV<arr ?>";
    case OBJECT:
      return "JSV<obj ?>";
    case BIGINT:
      return "JSV<bigint ?>";
  }
  return "JSV<?>";
}

char* jsNumber_debug(JsNumber* arg) {
  char* s = malloc(100);
  snprintf(s, 100, "JSV<num %d>", arg->value);
  return s;
}

char* jsString_debug(JsString* arg) {
  char* s = malloc(1000);
  char* v = malloc(1000);
  int len = arg->length < 999 ? arg->length : 999;
  memcpy(v, arg->chars, len);
  v[len] = 0;
  snprintf(s, 1000, "JSV<str %d \"%s\">", arg->length, v);
  return s;
}
