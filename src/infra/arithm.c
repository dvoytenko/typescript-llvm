#include "arithm.h"
#include "jsvalue.h"
#include "jsnumber.h"

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

JsValue* jsValue_sub(JsValue* a, JsValue* b) {
  if (a->jsType == NUMBER && b->jsType == NUMBER) {
    JsNumber* an = (JsNumber *) a;
    JsNumber* bn = (JsNumber *) b;
    int sub = an->value - bn->value;
    return (JsValue*) jsNumber_create(sub);
  }

  // TODO: string, other types, toPrimitive, undefined.
  return (JsValue*) JSNULL;
}
