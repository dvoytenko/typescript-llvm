#include "jsnumber.h"

#include <stdlib.h>
#include "jsvalue.h"

JsNumber* jsNumber_create(int value) {
  // Singleton values.
  if (value == 0) {
    return (JsNumber*) JSZERO;
  }

  JsNumber* ptr = (JsNumber*) malloc(sizeof(JsNumber));
  ptr->jsType = NUMBER;
  ptr->value = value;
  return ptr;
}
