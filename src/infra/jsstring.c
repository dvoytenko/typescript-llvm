#include <stdlib.h>
#include <stdbool.h>
#include "jsstring.h"

JsString* jsString_create(int length, char* chars) {
  JsString* ptr = (JsString*) malloc(sizeof(JsString));
  jsString_init(ptr, length, chars);
  return ptr;
}

void jsString_init(JsString* ptr, int length, char* chars) {
  ptr->jsType = STRING;
  ptr->length = length;
  ptr->chars = chars;
}

bool jsString_equals(JsString* s1, JsString* s2) {
  if (s1 == s2) {
    return true;
  }
  if (s1->length != s2->length) {
    return false;
  }
  for (int i = 0; i < s1->length; i++) {
    if (s1->chars[i] != s2->chars[i]) {
      return false;
    }
  }
  return true;
}
