
import * as path from 'path';
import {promises as fsPromises} from 'fs';
import { exec } from 'child_process';
import { compile } from '../src/compiler';
import { compile as compile2} from '../src/compiler/compiler2';

const TEST = 'three';

console.log('Any specific test specified? ', process.argv[2]);

const WORK_DIR = __dirname;
const DATA_DIR = path.resolve(WORK_DIR, '..', '..', 'test', 'data');
console.log(WORK_DIR);
console.log(DATA_DIR);

async function run(dir: string) {
  const files = await fsPromises.readdir(dir);
  console.log('DIR: ', dir);
  console.log('FILES: ', files);
  for (const fileName of files) {
    const file = path.resolve(dir, fileName);
    const stat = await fsPromises.stat(file);
    if (stat.isDirectory()) {
      await run(file);
    } else if ((file.endsWith('.ts') || file.endsWith('.tsx'))
        && !file.endsWith('.d.ts')
        && !file.endsWith('jsx.ts')) {
      await test(path.relative(DATA_DIR, file));
    }
  }
}

async function test(file: string): Promise<void> {
  console.log('TS(X) FILE: ', file);
  if (!file.includes(TEST)) {
    return;
  }

  const workDir = path.dirname(path.resolve(WORK_DIR, file));
  console.log('WORK DIR: ', workDir);
  const workDirStats = await fsPromises.stat(workDir);
  if (!workDirStats.isDirectory()) {
    await fsPromises.mkdir(workDir, {recursive: true});
  }

  const sourceFile = path.resolve(DATA_DIR, file);

  // const ll = compile(sourceFile);
  const ll = compile2(sourceFile);
  // const ll = compile3(sourceFile);

  const llFile = path.resolve(workDir, file.replace('.tsx', '.ll').replace('.ts', '.ll'));
  await fsPromises.writeFile(llFile, ll);

  const llLinkedFile = path.resolve(workDir, llFile.replace('.ll', '-linked.ll'));
  const llInfraFile = path.resolve(WORK_DIR, '..', 'infra', 'infra.ll');
  await execLlLink(llLinkedFile, [llFile, llInfraFile]);

  const result = await execLl(llLinkedFile);
  console.log(`${'\x1b[34m'}RESULT:\n${result}`, '\x1b[0m');

  const llOptFile = path.resolve(workDir, llFile.replace('.ll', '.Oz.ll'));
  await execLlOpt(llFile, llOptFile, '-Oz');

  /* QQQ
  const origFile = path.resolve(DATA_DIR, llFile.replace('.ll', '.res'));
  const resultFile = path.resolve(workDir, path.basename(llFile, '.ll') + '.res');
  console.log('RESULT FILE: ', resultFile);
  await fsPromises.writeFile(resultFile, result);

  const diff = await execDiff(origFile, resultFile);
  console.log('DIFF: ', diff);
  */
}

function execLl(file: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    exec('lli ' + file, (error, stdout, stderr) => {
      if (error) {
        console.log(stdout);
        reject(new Error(`error: ${error.message}`));
      } else if (stderr) {
        console.log(stdout);
        reject(new Error(`stderr: ${stderr}`));
      } else {
        resolve(stdout);
      }
    });
  });
}

function execLlLink(outFile: string, files: string[]): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const cmd = `llvm-link -S -o ${outFile} ${files.join(' ')}`;
    console.log('LINK CMD: ', cmd);
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        console.log(stdout);
        reject(new Error(`error: ${error.message}`));
      } else if (stderr) {
        console.log(stdout);
        reject(new Error(`stderr: ${stderr}`));
      } else {
        resolve(stdout);
      }
    });
  });
}

function execLlOpt(inFile: string, outFile: string, opts: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const cmd = `opt ${opts} -S -o ${outFile} ${inFile}`;
    console.log('OPT CMD: ', cmd);
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        console.log(stdout);
        reject(new Error(`error: ${error.message}`));
      } else if (stderr) {
        console.log(stdout);
        reject(new Error(`stderr: ${stderr}`));
      } else {
        resolve(stdout);
      }
    });
  });
}

function execDiff(file1: string, file2: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    exec('diff ' + file1 + ' ' + file2, (error, stdout, stderr) => {
      // console.log('DIFF RES: ', error, error?.code, error?.message, stderr, stdout);
      if (error && error.code! > 1) {
        reject(new Error(`error: ${error.message}`));
      } else if (stderr) {
        resolve(stderr);
      } else {
        resolve(stdout);
      }
    });
  });
}

run(DATA_DIR);
