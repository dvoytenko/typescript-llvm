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
