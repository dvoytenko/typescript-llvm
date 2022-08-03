#include <stdlib.h>
#include <stdio.h>
#include "tostring.h"
#include "jsvalue.h"
#include "jsstring.h"

char* jsValue_toString(JsValue* val) {
  if (!val) {
    return "NULL";
  }
  char* buf = (char*) malloc(100);
  switch (val->jsType) {
    case STRING:
      // JsString* str = (JsString*) val;
      snprintf(buf, 100, "JSS<%s>", ((JsString*) val)->chars);
      break;
    default:
      snprintf(buf, 100, "JSV%d", val->jsType);
  }
  return buf;
}
