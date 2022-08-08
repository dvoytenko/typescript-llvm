import * as path from 'path';
import {promises as fsPromises} from 'fs';
// import { WASI } from 'wasi';

async function run(file: string) {
  console.log('WASM file: ', file);

  const contents = await fsPromises.readFile(file);
  const instance = await WebAssembly.instantiate(contents);
  const mainExport = instance.instance.exports.main as unknown as Function;

  const result = mainExport();
  console.log('RESULT:', result);
}

if (process.argv[2]) {
  run(path.resolve(__dirname, process.argv[2]));
} else {
  console.log('Help: run_wasm <wasm file>');
}
