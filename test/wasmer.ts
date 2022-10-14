/*
Copyright 2022 Google LLC

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    https://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { promises as fsPromises } from "fs";
import { JsType } from "../src/compiler/types/jsvalue";

const PTR_BITS = 32;
const PTR_BYTES = PTR_BITS / 8;

export async function exec(contents: Buffer): Promise<void> {
  const memory = new WebAssembly.Memory({ initial: 32 });
  const output: string[] = [];
  const context: Context = {
    ptr: 8000,
    // ptr: 0x100000,
    memory,
    output(v) {
      output.push(String(v));
    },
  };
  const instance = await WebAssembly.instantiate(contents, {
    env: {
      memory,
      malloc: malloc.bind(null, context),
      memcpy: memcpy.bind(null, context),
      strcat: strcat.bind(null, context),
      snprintf: snprintf.bind(null, context),
      puts: puts.bind(null, context),
      printf: printf.bind(null, context),
      currentTimeMillis: () => performance.now(),
      __snprintf_chk: (
        ptr: number,
        maxLen: bigint,
        flag: number,
        slen: bigint,
        fmtPtr: number,
        vPtr: number
      ) => snprintf(context, ptr, Number(maxLen), fmtPtr, vPtr),
      jsValue_debugIntercept: jsValue_debugIntercept.bind(null, context),
    },
  });
  const mainExport = instance.instance.exports.main as unknown as Function;
  mainExport();
  console.log(`${"\x1b[34m"}WASM RESULT:\n${output.join("\n")}`, "\x1b[0m");
}

export async function execFile(wasmFile: string): Promise<any> {
  const contents = await fsPromises.readFile(wasmFile);
  return exec(contents);
}

interface Context {
  ptr: number;
  memory: WebAssembly.Memory;
  output: (v: any) => void;
}

function malloc(context: Context, size: bigint | number) {
  const res = context.ptr;
  context.ptr += Number(size);
  return res;
}

function memcpy(
  context: Context,
  destPtr: number,
  srcPtr: number,
  len: number
) {
  const { memory } = context;
  const src = new Uint8Array(memory.buffer, srcPtr, len);
  const dest = new Uint8Array(memory.buffer, destPtr, len);
  for (let i = 0; i < len; i++) {
    dest[i] = src[i];
  }
}

function strcat(context: Context, destPtr: number, srcPtr: number) {
  const { memory } = context;
  // TODO: fix.
  const maxLen = 1000;
  const dest = new Uint8Array(memory.buffer, destPtr, maxLen);
  const destLen = strlen(dest, maxLen);
  const src = new Uint8Array(memory.buffer, srcPtr, maxLen);
  const srcLen = strlen(src, maxLen);
  for (let i = 0; i < srcLen; i++) {
    dest[destLen + i] = src[i];
  }
  dest[destLen + srcLen] = 0;
}

function snprintf(
  context: Context,
  ptr: number,
  maxBuffer: number | bigint,
  fmtPtr: number,
  vPtr: number
) {
  maxBuffer = Number(maxBuffer);
  const { memory } = context;

  const formatted = formatf(context, maxBuffer, fmtPtr, vPtr);

  const res = new Uint8Array(memory.buffer, ptr, maxBuffer);
  const resLen = Math.min(maxBuffer, formatted.length);
  for (let i = 0; i < resLen; i++) {
    res[i] = formatted.charCodeAt(i);
  }
  res[resLen] = 0;
}

function printf(context: Context, fmtPtr: number, vPtr: number) {
  const { output } = context;

  const formatted = formatf(context, 1000, fmtPtr, vPtr);
  output(formatted);
  return 0;
}

function formatf(
  context: Context,
  maxBuffer: number,
  fmtPtr: number,
  vPtr: number
) {
  const fmt = readString(context, fmtPtr, 1000);

  return fmt.replace(/%./g, (mask: string) => {
    if (mask === "%s") {
      // It's a pointer.
      const sPtr = readPtr(context, vPtr);
      vPtr += PTR_BYTES;
      if (sPtr === 0) {
        return "";
      }
      return readString(context, sPtr, maxBuffer);
    }
    if (mask === "%d") {
      const v = readI32(context, vPtr);
      vPtr += 4;
      return String(v);
    }
    if (mask === "%f") {
      const v = readF64(context, vPtr);
      vPtr += 9;
      return String(v);
    }
    return "?";
  });
}

function puts(context: Context, ptr: number) {
  const { output } = context;
  output(readString(context, ptr, 1000));
}

function readString(context: Context, ptr: number, maxLength: number): string {
  const { memory } = context;
  const maxArr = new Uint8Array(memory.buffer, ptr, maxLength);
  const end = strlen(maxArr, maxLength);
  return String.fromCharCode(...maxArr.subarray(0, end));
}

function strlen(arr: Uint8Array, maxLen: number) {
  let end = 0;
  for (end = 0; end < maxLen; end++) {
    if (arr[end] === 0) {
      break;
    }
  }
  return end;
}

// TODO: ideally it should be bigint return.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function readI64(context: Context, ptr: number): number {
  const { memory } = context;
  const slice = memory.buffer.slice(ptr, ptr + 8);
  const arr = new BigUint64Array(slice);
  return Number(arr[0]);
}

function readI32(context: Context, ptr: number): number {
  const { memory } = context;
  const slice = memory.buffer.slice(ptr, ptr + 4);
  const arr = new Uint32Array(slice);
  return Number(arr[0]);
}

function readF64(context: Context, ptr: number): number {
  const { memory } = context;
  const slice = memory.buffer.slice(ptr, ptr + 8);
  const arr = new Float64Array(slice);
  return Number(arr[0]);
}

function readPtr(context: Context, ptr: number): number {
  return PTR_BITS === 32 ? readI32(context, ptr) : readI64(context, ptr);
}

function jsValue_debugIntercept(context: Context, ptr: number) {
  jsValue_debug(context, ptr);
}

function jsValue_debug(context: Context, ptr: number, quiet = false): any {
  function log(...args: any[]) {
    if (!quiet) {
      console.log(...args);
    }
  }

  const { memory } = context;
  // QQQQ
  log("jsValue_debugIntercept:", ptr);
  const arr = new Uint8Array(memory.buffer, ptr, 32);
  log(arr);

  const jsType = readI32(context, ptr);
  let vPtr = ptr + 4;
  log("- jsType:", jsType);

  if (jsType === JsType.OBJECT) {
    /*
      typedef struct JsObject {
        // JsValue:
        enum JsType jsType;
        // JsObject:
        VTable* vtable;
        JsvMap* map;
      } JsObject;
     */
    const vtablePtr = readPtr(context, vPtr);
    vPtr += PTR_BYTES;
    log("- vtablePtr:", vtablePtr);

    const mapPtr = readPtr(context, vPtr);
    vPtr += PTR_BYTES;
    log("- mapPtr:", mapPtr);

    if (vtablePtr) {
      //   const arr2 = new Uint8Array(memory.buffer, vtablePtr, 32);
      //   log(arr2);

      const fieldCount = readI32(context, vtablePtr);
      log("- fieldCount:", fieldCount);

      if (fieldCount === 3) {
        const typePtr = readPtr(context, vPtr);
        vPtr += PTR_BYTES;
        const type = jsValue_debug(context, typePtr, true);
        log("-- typePtr:", typePtr, type);

        const propsPtr = readPtr(context, vPtr);
        vPtr += PTR_BYTES;
        const props = jsValue_debug(context, propsPtr, true);
        log("-- propsPtr:", propsPtr, props);

        const childrenPtr = readPtr(context, vPtr);
        vPtr += PTR_BYTES;
        const children = jsValue_debug(context, childrenPtr, false);
        log("-- childrenPtr:", childrenPtr, children);

        return { type, props, children };
      }

      //   const fieldsPtr = readPtr(context, vtablePtr + 4);
      //   log("- fields.ptr:", fieldsPtr);
      //   if (fieldsPtr) {
      //     const arr3 = new Uint8Array(memory.buffer, fieldsPtr, 32);
      //     log(arr3);

      //     log("- field.name?: ", readString(context, fieldsPtr, 100));

      //     const xPtr = readPtr(context, fieldsPtr);
      //     const arr4 = new Uint8Array(memory.buffer, xPtr, 32);
      //     log(arr4);
      //   }
    }
    return { someObj: true };
  }
  if (jsType === JsType.ARRAY) {
    /*
      typedef struct JsArray {
        // JsValue:
        enum JsType jsType;
        // JsArray:
        int length;
        JsValue** arr;
      } JsArray;
    */

    const len = readI32(context, vPtr);
    vPtr += 4;
    log("- len:", len);

    const arrPtr = readPtr(context, vPtr);
    vPtr += PTR_BYTES;
    log("- arrPtr:", arrPtr);
    log(new Uint8Array(memory.buffer, arrPtr, 32));

    if (len > 0) {
      const v0Ptr = readPtr(context, arrPtr);
      log("- v0Ptr:", v0Ptr);
      log(new Uint8Array(memory.buffer, v0Ptr, 32));
      // children: 1107, vs 1904?
      return `[*${v0Ptr}, ...]`;
    }

    return "ARRAY";
  }
  if (jsType === JsType.STRING) {
    /*
      typedef struct JsString {
        // JsValue value;
        enum JsType jsType;
        //
        int length;
        // TODO: switch to i16.
        char* chars;
      } JsString;
    */
    const length = readI32(context, vPtr);
    vPtr += 4;
    log("- str.length:", length);

    const charsPtr = readPtr(context, vPtr);
    vPtr += PTR_BYTES;
    log("- str.ptr:", charsPtr);

    const str = readString(context, charsPtr, 1000);
    log("- str:", str);
    return str;
  }
  if (jsType === JsType.NUMBER) {
    /*
      typedef struct JsNumber {
        // JsValue value = NUMBER
        enum JsType jsType;
        //
        // TODO: switch to double
        int value;
      } JsNumber;
    */
    const num = readI32(context, vPtr);
    vPtr += 4;
    log("- num: ", num);
    return num;
  }

  // 128, 5, 0, 0 --> 1408
  // 64, 31, 0, 0 --> 8000
  // 81, 31, 0, 0 --> 8017
  return "NOT_SUPPORTED";
}
