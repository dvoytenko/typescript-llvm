import { execFile } from "./wasmer";

async function run(wasmFile: string): Promise<void> {
  await execFile(wasmFile);
}

if (!process.argv[2]) {
  console.log("run_wasmer <file.wasm>");
} else {
  run(process.argv[2]);
}
