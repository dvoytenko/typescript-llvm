#ifndef __JSVMAP_H__
#define __JSVMAP_H__

#include "jsvalue.h"
#include "jsstring.h"

typedef struct JsvMapEntry JsvMapEntry;

typedef struct JsvMap {
  int length;
  JsvMapEntry* entries;
} JsvMap;

typedef struct JsvMapEntry {
  JsString* key;
  JsValue* val;
} JsvMapEntry;

JsvMap* jsvMap_create();
JsValue* jsvMap_getField(JsvMap* ptr, JsString* key);
void jsvMap_setField(JsvMap* ptr, JsString* key, JsValue* val);

#endif
