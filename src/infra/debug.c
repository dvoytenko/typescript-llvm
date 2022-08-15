#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "jsarray.h"
#include "jsnumber.h"
#include "jsvalue.h"
#include "jsobject.h"
#include "jsstring.h"
#include "jsvmap.h"

void jsValue_debugIntercept(JsValue* arg);

char* jsArray_debug(JsArray* arg);
char* jsNumber_debug(JsNumber* arg);
char* jsString_debug(JsString* arg);
char* jsObject_debug(JsObject* arg);

char* jsValue_debug(JsValue* arg) {
  if (!arg) {
    return "NULL";
  }
  switch (arg->jsType) {
    case ANY:
      return "JSV<any>";
    case UNDEFINED:
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
      return jsArray_debug((JsArray*) arg);
    case OBJECT:
      return jsObject_debug((JsObject*) arg);
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
  __builtin_memcpy(v, arg->chars, len);
  v[len] = 0;
  snprintf(s, 1000, "JSV<str %d \"%s\">", arg->length, v);
  return s;
}

char* jsArray_debug(JsArray* arg) {
  int len = arg->length;
  JsValue** arr = arg->arr;
  char* arr_s = malloc(1000);
  arr_s[0] = 0;
  for (int i = 0; i < len; i++) {
    __builtin_strcat(arr_s, jsValue_debug(arr[i]));
  }

  char* s = malloc(1000);
  snprintf(s, 1000, "JSV<[%d: %s]>", len, arr_s);
  return s;
}

char* jsObject_debug(JsObject* arg) {
  char* s = malloc(1000);
  int len = arg->vtable->fields.length;
  if (len == 0) {  
    return "JSV<obj {}>";
  }

  // QQQ: this is horrible! Oh, my eyes! my eyes!
  if (len == 1) {
    snprintf(s, 1000, "JSV<{%s: %s}>",
      jsValue_debug((JsValue*) arg->vtable->fields.fields[0].field),
      jsValue_debug(jsObject_getField(arg, arg->vtable->fields.fields[0].field))
    );
  } else if (len == 2) {
    snprintf(s, 1000, "JSV<{%s: %s, %s: %s}>",
      jsValue_debug((JsValue*) arg->vtable->fields.fields[0].field),
      jsValue_debug(jsObject_getField(arg, arg->vtable->fields.fields[0].field)),
      jsValue_debug((JsValue*) arg->vtable->fields.fields[1].field),
      jsValue_debug(jsObject_getField(arg, arg->vtable->fields.fields[1].field))
    );
  } else if (len == 3) {
    snprintf(s, 1000, "JSV<{%s: %s, %s: %s, %s: %s}>",
      jsValue_debug((JsValue*) arg->vtable->fields.fields[0].field),
      jsValue_debug(jsObject_getField(arg, arg->vtable->fields.fields[0].field)),
      jsValue_debug((JsValue*) arg->vtable->fields.fields[1].field),
      jsValue_debug(jsObject_getField(arg, arg->vtable->fields.fields[1].field)),
      jsValue_debug((JsValue*) arg->vtable->fields.fields[2].field),
      jsValue_debug(jsObject_getField(arg, arg->vtable->fields.fields[2].field))
    );
  } else {
    snprintf(s, 1000, "JSV<{%s: %s, %s: %s, %s: %s, +%d more}>",
      jsValue_debug((JsValue*) arg->vtable->fields.fields[0].field),
      jsValue_debug(jsObject_getField(arg, arg->vtable->fields.fields[0].field)),
      jsValue_debug((JsValue*) arg->vtable->fields.fields[1].field),
      jsValue_debug(jsObject_getField(arg, arg->vtable->fields.fields[1].field)),
      jsValue_debug((JsValue*) arg->vtable->fields.fields[2].field),
      jsValue_debug(jsObject_getField(arg, arg->vtable->fields.fields[2].field)),
      len - 3
    );
  }
  return s;
}
