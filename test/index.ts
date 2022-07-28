
import * as path from 'path';
import {promises as fsPromises} from 'fs';
import { exec } from 'child_process';
import { compile } from '../src/compiler';
import { compile as compile3} from '../src/compiler/compiler3';

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
    } else if (file.endsWith('.ts')) {
      await test(path.relative(DATA_DIR, file));
      // if (file.endsWith('.ll')) {
      //   await execLl(file);
      // }
    }
  }
}

async function test(file: string): Promise<void> {
  console.log('TS FILE: ', file);
  if (!file.includes('four')) {
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
  const ll = compile3();
  const llFile = path.resolve(workDir, file.replace('.ts', '.ll'));
  await fsPromises.writeFile(llFile, ll);
  const result = await execLl(llFile);
  console.log('RESULT: ', result);

  /* QQQQ
  const llFile = path.resolve(DATA_DIR, file.replace('.ts', '.ll'));
  const result = await execLl(llFile);
  console.log('RESULT: ', result);

  const origFile = path.resolve(DATA_DIR, file.replace('.ts', '.res'));
  const resultFile = path.resolve(workDir, path.basename(file, '.ts') + '.res');
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
        reject(new Error(`error: ${error.message}`));
      } else if (stderr) {
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
