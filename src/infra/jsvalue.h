#ifndef __JSVALUE_H__
#define __JSVALUE_H__

enum JsType {
  UDNEFINED = 0,
  NULLV,
  BOOL,
  NUMBER,
  STRING,
  SYMBOL,
  FUNCTION,
  ARRAY,
  OBJECT,
  BIGINT,
  // Extensions?
  // INT32,
  // UINT32,
  // DATE,
  // REGEXP,
  // ERROR,
};

typedef struct JsValue {
  enum JsType jsType;
} JsValue;

static const JsValue JSNULL_VALUE = {.jsType = NULLV};
static const JsValue* JSNULL = &JSNULL_VALUE;

#endif
