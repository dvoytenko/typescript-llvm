import * as path from "path";
import { promises as fsPromises } from "fs";
import { exec } from "child_process";
import { compile } from "../src/compiler/compiler";
import { execFile } from "./wasmer";
import { buildCycler } from "./llcycler";

const TEST = null;
const DIFF = true;
const WASM = false;
const WASM_EXEC = false;
const CYCLER = false;

console.log("Any specific test specified? ", process.argv[2]);

const WORK_DIR = __dirname;
const DATA_DIR = path.resolve(WORK_DIR, "..", "..", "test", "data");
console.log(WORK_DIR);
console.log(DATA_DIR);

async function run(dir: string) {
  const files = await fsPromises.readdir(dir);
  console.log("DIR: ", dir);
  console.log("FILES: ", files);
  for (const fileName of files) {
    const file = path.resolve(dir, fileName);
    const stat = await fsPromises.stat(file);
    if (stat.isDirectory()) {
      await run(file);
    } else if (
      (fileName.endsWith(".ts") || fileName.endsWith(".tsx")) &&
      !fileName.endsWith(".d.ts") &&
      !fileName.startsWith("lib-")
    ) {
      await test(path.relative(DATA_DIR, file));
    }
  }
}

async function test(file: string): Promise<void> {
  console.log("TS(X) FILE: ", file);
  if (TEST != null && !file.includes(TEST)) {
    return;
  }

  const workDir = path.dirname(path.resolve(WORK_DIR, file));
  // console.log('WORK DIR: ', workDir);
  const workDirStats = await fsPromises.stat(workDir);
  if (!workDirStats.isDirectory()) {
    await fsPromises.mkdir(workDir, { recursive: true });
  }

  const sourceFile = path.resolve(DATA_DIR, file);

  const ll = compile(sourceFile);

  const llFile = path.resolve(
    workDir,
    file.replace(".tsx", ".ll").replace(".ts", ".ll")
  );
  await fsPromises.writeFile(llFile, ll);

  const llLinkedFile = path.resolve(
    workDir,
    llFile.replace(".ll", "-linked.ll")
  );
  const llInfraFile = path.resolve(WORK_DIR, "..", "infra", "infra.ll");
  await llLink(llLinkedFile, [llFile, llInfraFile]);

  if (CYCLER) {
    runCycler(workDir, llLinkedFile);
    return;
  }

  const result = await execLl(llLinkedFile);
  console.log(`${"\x1b[34m"}RESULT:\n${result}`, "\x1b[0m");

  const llOptFile = path.resolve(workDir, llFile.replace(".ll", ".Oz.ll"));
  await llOpt(llFile, llOptFile, "-Oz");

  if (WASM) {
    await buildWasm(llFile);
    if (WASM_EXEC) {
      const wasmLinkedFile = await buildWasm(llLinkedFile);
      await execWasm(wasmLinkedFile);
    }
  }

  if (DIFF) {
    const origFile = sourceFile.replace(".tsx", ".res").replace(".ts", ".res");
    const resultFile = path.resolve(
      workDir,
      path.basename(llFile, ".ll") + ".res"
    );
    await fsPromises.writeFile(resultFile, result);

    const diffResult = await diff(origFile, resultFile);
    if (diffResult.trim()) {
      console.log(`${"\x1b[31m"}DIFF:\n${diffResult}`, "\x1b[0m");
    } else {
      console.log(`${"\x1b[32m"}NO DIFF${"\x1b[0m"}`);
    }
  }
}

async function runCycler(workDir: string, file: string) {
  console.log("CYCLER: " + file);
  const numberOfCycles = 100000;

  const orig = await fsPromises.readFile(file);

  const cyclerFile = path.resolve(workDir, file.replace(".ll", ".cycler.ll"));

  await fsPromises.writeFile(
    cyclerFile,
    buildCycler(numberOfCycles, orig.toString())
  );

  const optFile = path.resolve(workDir, cyclerFile.replace(".ll", ".Oz.ll"));
  await llOpt(cyclerFile, optFile, "-Oz");

  const result = await execLl(optFile);
  console.log(`${"\x1b[34m"}RESULT:\n${result}`, "\x1b[0m");
}

function execLl(file: string): Promise<string> {
  const cmd = "lli " + file;
  return execCmd(cmd);
}

function llLink(outFile: string, files: string[]): Promise<string> {
  const cmd = `llvm-link -S -o ${outFile} ${files.join(" ")}`;
  return execCmd(cmd);
}

function llOpt(inFile: string, outFile: string, opts: string): Promise<string> {
  const cmd = `opt ${opts} -S -o ${outFile} ${inFile}`;
  return execCmd(cmd);
}

async function buildWasm(llFile: string, opts?: string): Promise<string> {
  // 1. Object file:
  const objFile = llFile.replace(".ll", ".o");
  await execCmd(
    `llc -mtriple=wasm32-unknown-unknown ${
      opts ?? ""
    } -filetype=obj ${llFile} -o ${objFile}`,
    true
  );

  // 2. WASM file:
  const wasmFile = llFile.replace(".ll", ".wasm");
  await execCmd(
    `wasm-ld ${objFile} -o ${wasmFile} -allow-undefined --entry "main" --import-memory`
  );

  // 3. WAT file:
  const watFile = llFile.replace(".ll", ".wat");
  await execCmd(`wasm2wat ${wasmFile} -o ${watFile}`);

  return wasmFile;
}

async function execWasm(wasmFile: string): Promise<void> {
  await execFile(wasmFile);
}

function execCmd(cmd: string, tolerateStderr = false): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        console.log(stdout);
        reject(new Error(`error in ${cmd}: ${error.message}`));
      } else if (stderr) {
        if (tolerateStderr) {
          resolve(stdout);
        } else {
          console.log(stderr);
          reject(new Error(`stderr in ${cmd}: ${stderr}`));
        }
      } else {
        resolve(stdout);
      }
    });
  });
}

function diff(file1: string, file2: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const cmd = "diff " + file1 + " " + file2;
    exec(cmd, (error, stdout, stderr) => {
      if (error && error.code! > 1) {
        reject(new Error(`error in ${cmd}: ${error.message}`));
      } else if (stderr) {
        resolve(stderr);
      } else {
        resolve(stdout);
      }
    });
  });
}

run(DATA_DIR);
