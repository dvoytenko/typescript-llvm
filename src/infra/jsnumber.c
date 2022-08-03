#include "jsnumber.h"

#include <stdlib.h>
#include "jsvalue.h"

JsNumber* jsNumber_create(int value) {
  JsNumber* ptr = (JsNumber*) malloc(sizeof(JsNumber));
  ptr->jsType = NUMBER;
  ptr->value = value;
  return ptr;
}
