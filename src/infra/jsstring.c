#include <stdbool.h>
#include "jsstring.h"

void jsString_init(JsString* ptr, int length, char* chars) {
  ptr->jsType = STRING;
  ptr->length = length;
  ptr->chars = chars;
}

bool jsString_equals(JsString* s1, JsString* s2) {
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
