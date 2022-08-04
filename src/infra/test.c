#include <stddef.h>
#include <stdio.h>
#include <stdlib.h>
#include <stdbool.h>
#include "jsvalue.h"
#include "jsstring.h"
#include "jsvmap.h"
#include "jsobject.h"
#include "jsnumber.h"
#include "debug.h"
#include "stricteq.h"
#include "arithm.h"
#include "vtable.h"

typedef struct Cust1 {
  int a;
  JsString* b;
} Cust1;

typedef struct JsCustObject1 {
  // JsValue:
  enum JsType jsType;
  // JsObject:
  VTable* vtable;
  JsvMap* map;
  // Custom:
  struct Cust1 cust;
} JsCustObject1;

int main(void) {
  JsNumber jsn = {.jsType = NUMBER, .value = 11};
  printf("num: %s\n", jsValue_debug((JsValue*) &jsn));

  VTable vtable = {.fields = {.length = 0, .fields = NULL}};
  JsObject jsv;
  jsObject_init(&jsv, &vtable);

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
  printf("sub: %s\n", jsValue_debug((JsValue*) jsValue_sub((JsValue*) &jsn, (JsValue*) &jsn2)));

  char keySb[1] = {'b'};

  VTableField field1a = {
    .field = jsString_create(1, keyS),
    .jsType = NUMBER,
    .boxed = false,
    .offset = offsetof(struct Cust1, a)
  };
  VTableField field1b = {
    .field = jsString_create(1, keySb),
    .jsType = STRING,
    .boxed = true,
    .offset = offsetof(struct Cust1, b)
  };
  VTableField fields1[2] = {field1a, field1b};
  VTable vtable1 = {.fields = {.length = 2, .fields = fields1}};
  printf("vtable: a=%d, b=%d\n", field1a.offset, field1b.offset);

  JsCustObject1 jsv1;
  jsv1.cust.a = 17;
  jsv1.cust.b = &val;
  JsObject* jsv1o = (JsObject*) &jsv1;
  jsObject_init(jsv1o, &vtable1);
  printf("vtable values: a=%s, b=%s\n",
    jsValue_debug(vTable_getField(jsv1o, field1a.field)),
    jsValue_debug(vTable_getField(jsv1o, field1b.field)));

  return 0;
}
