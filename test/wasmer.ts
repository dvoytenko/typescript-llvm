import { promises as fsPromises } from "fs";

export async function exec(contents: Buffer): Promise<void> {
  const memory = new WebAssembly.Memory({ initial: 32 });
  const output: string[] = [];
  const context: Context = {
    ptr: 1,
    memory,
    output(v) {
      output.push(String(v));
    },
  };
  const noop = () => 1;
  const instance = await WebAssembly.instantiate(contents, {
    env: {
      memory,
      malloc: malloc.bind(null, context),
      snprintf: snprintf.bind(null, context),
      puts: puts.bind(null, context),
      __snprintf_chk: noop,
      __memcpy_chk: noop,
      __strcat_chk: noop,
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
      const sPtr = readI64(context, vPtr);
      vPtr += 8;
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
  for (let i = 0; i < Math.min(maxBuffer, formatted.length); i++) {
    res[i] = formatted.charCodeAt(i);
  }
}

function puts(context: Context, ptr: number) {
  const { output } = context;
  output(readString(context, ptr, 1000));
}

function readString(context: Context, ptr: number, maxLength: number): string {
  const { memory } = context;
  const maxArr = new Uint8Array(memory.buffer, ptr, maxLength);
  let end = 0;
  for (end = 0; end < maxLength; end++) {
    if (maxArr[end] === 0) {
      break;
    }
  }
  return String.fromCharCode(...maxArr.subarray(0, end));
}

// TODO: ideally it should be bigint return.
function readI64(context: Context, ptr: number): number {
  const { memory } = context;
  const arr = new BigUint64Array(memory.buffer, ptr, 1);
  return Number(arr[0]);
}

function readI32(context: Context, ptr: number): number {
  const { memory } = context;
  const arr = new Uint32Array(memory.buffer, ptr, 1);
  return Number(arr[0]);
}
