#include <stdio.h>
#include <stdlib.h>
#include "jsvalue.h"
#include "jsstring.h"
#include "jsvmap.h"
#include "jsobject.h"
#include "tostring.h"

int main(void) {
  JsObject jsv;
  jsObject_init(&jsv);

  JsString key;
  char keyS[2] = {'a', '\00'};
  jsString_init(&key, 1, keyS);
  printf("key: %s\n", jsValue_toString((JsValue*) &key));

  JsValue* val1 = jsObject_getField(&jsv, &key);
  printf("getField: %s\n", jsValue_toString((JsValue*) val1));

  JsString val;
  char valS[2] = {'A', '\00'};
  jsString_init(&val, 1, valS);
  jsObject_setField(&jsv, &key, (JsValue*) &val);

  JsValue* val2 = jsObject_getField(&jsv, &key);
  printf("getField2: %s\n", jsValue_toString((JsValue*) val2));

  return 0;
}
