#ifndef __ARITHM_H__
#define __ARITHM_H__

#include "jsvalue.h"
#include "jsnumber.h"

JsValue* jsValue_add(JsValue* a, JsValue* b);
JsNumber* jsValue_sub(JsValue* a, JsValue* b);

#endif
