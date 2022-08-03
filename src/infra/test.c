#include <stdio.h>
#include <stdlib.h>
#include "jsvalue.h"
#include "jsstring.h"
#include "jsvmap.h"
#include "jsobject.h"
#include "jsnumber.h"
#include "debug.h"
#include "stricteq.h"
#include "arithm.h"

int main(void) {
  JsNumber jsn = {.jsType = NUMBER, .value = 11};
  printf("num: %s\n", jsValue_debug((JsValue*) &jsn));

  JsObject jsv;
  jsObject_init(&jsv);

  JsString key;
  char keyS[1] = {'a'};
  jsString_init(&key, 1, keyS);
  printf("key: %s\n", jsValue_debug((JsValue*) &key));

  JsValue* val1 = jsObject_getField(&jsv, &key);
  printf("getField: %s\n", jsValue_debug((JsValue*) val1));

  JsString val;
  char valS[1] = {'A'};
  jsString_init(&val, 1, valS);
  jsObject_setField(&jsv, &key, (JsValue*) &val);

  JsValue* val2 = jsObject_getField(&jsv, &key);
  printf("getField2: %s\n", jsValue_debug((JsValue*) val2));

  JsString equiv;
  char equivS[1] = {'a'};
  jsString_init(&equiv, 1, equivS);

  printf(
    "eq: self=%d, equiv=%d, other=%d, diff type=%d\n",
    jsValue_strictEq((JsValue*) &key, (JsValue*) &key),
    jsValue_strictEq((JsValue*) &key, (JsValue*) &equiv),
    jsValue_strictEq((JsValue*) &key, (JsValue*) &val),
    jsValue_strictEq((JsValue*) &key, (JsValue*) &jsn));
  
  JsNumber jsn2 = {.jsType = NUMBER, .value = 3};
  printf("add: %s\n", jsValue_debug(jsValue_add((JsValue*) &jsn, (JsValue*) &jsn2)));
  printf("sub: %s\n", jsValue_debug(jsValue_sub((JsValue*) &jsn, (JsValue*) &jsn2)));

  return 0;
}
