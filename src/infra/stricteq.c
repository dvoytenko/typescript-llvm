#include "stricteq.h"
#include "jsvalue.h"
#include "jsstring.h"

bool jsValue_strictEq(JsValue* v1, JsValue* v2) {
  if (v1 == v2) {
    return true;
  }

  // Different types.
  if (v1->jsType != v2->jsType) {
    return false;
  }

  if (v1->jsType == STRING) {
    return jsString_equals((JsString*) v1, (JsString*) v2);
  }

  // TODO: string, other types, toBoolean, undefined.
  return false;
}
