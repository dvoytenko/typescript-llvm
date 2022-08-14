import { promises as fsPromises } from "fs";

const PTR_BITS = 32;

export async function exec(contents: Buffer): Promise<void> {
  const memory = new WebAssembly.Memory({ initial: 32 });
  const output: string[] = [];
  const context: Context = {
    ptr: 8000,
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
      __snprintf_chk: (
        ptr: number,
        maxLen: bigint,
        flag: number,
        slen: bigint,
        fmtPtr: number,
        vPtr: number
      ) => snprintf(context, ptr, Number(maxLen), fmtPtr, vPtr),
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
  maxBuffer: number,
  fmtPtr: number,
  vPtr: number
) {
  const { memory } = context;

  const fmt = readString(context, fmtPtr, maxBuffer);

  const formatted = fmt.replace(/%./g, (mask: string) => {
    if (mask === "%s") {
      // It's a pointer.
      const sPtr = readPtr(context, vPtr);
      vPtr += PTR_BITS / 8;
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
    return "?";
  });

  const res = new Uint8Array(memory.buffer, ptr, maxBuffer);
  const resLen = Math.min(maxBuffer, formatted.length);
  for (let i = 0; i < resLen; i++) {
    res[i] = formatted.charCodeAt(i);
  }
  res[resLen] = 0;
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
  // BigUint64Array.
  return Number(arr[0]);
}

function readI32(context: Context, ptr: number): number {
  const { memory } = context;
  const arr = new Uint32Array(memory.buffer, ptr, 1);
  return Number(arr[0]);
}

function readPtr(context: Context, ptr: number): number {
  return PTR_BITS === 32 ? readI32(context, ptr) : readI64(context, ptr);
}
