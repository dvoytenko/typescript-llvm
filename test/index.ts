
import * as path from 'path';
import {promises as fsPromises} from 'fs';
import { exec } from 'child_process';
import { compile } from '../src/compiler';
import { compile as compile2} from '../src/compiler/compiler2';

const TEST = 'six';
const CYCLER = true;

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
        && !file.startsWith('lib-')) {
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

  if (CYCLER) {
    runCycler(workDir, llLinkedFile);
  } else {
    const result = await execLl(llLinkedFile);
    console.log(`${'\x1b[34m'}RESULT:\n${result}`, '\x1b[0m');

    const llOptFile = path.resolve(workDir, llFile.replace('.ll', '.Oz.ll'));
    await execLlOpt(llFile, llOptFile, '-Oz');
  }

  /* QQQ
  const origFile = path.resolve(DATA_DIR, llFile.replace('.ll', '.res'));
  const resultFile = path.resolve(workDir, path.basename(llFile, '.ll') + '.res');
  console.log('RESULT FILE: ', resultFile);
  await fsPromises.writeFile(resultFile, result);

  const diff = await execDiff(origFile, resultFile);
  console.log('DIFF: ', diff);
  */
}

async function runCycler(workDir: string, file: string) {
  console.log("CYCLER: " + file);
  const numberOfCycles = 100000;

  const orig = await fsPromises.readFile(file);

  const cyclerFile = path.resolve(workDir, file.replace('.ll', '.cycler.ll'));

  // TODO: redo via linker. pass number of cycles as an arg.
  await fsPromises.writeFile(cyclerFile,
    `${orig.toString()}

%struct.timeval = type { i64, i32 }
@.str_cycle_millis = private unnamed_addr constant [24 x i8] c"Total time = %f millis\\0A\\00", align 1
declare i32 @gettimeofday(%struct.timeval*, i8*) noinline nounwind optnone
declare i32 @printf(i8*, ...)

define i32 @main() {
  %1 = alloca i32, align 4
  %2 = alloca %struct.timeval, align 8
  %3 = alloca %struct.timeval, align 8
  %4 = alloca i32, align 4
  %5 = alloca double, align 8
  store i32 0, i32* %1, align 4
  %6 = call i32 @gettimeofday(%struct.timeval* %2, i8* null)
  store i32 0, i32* %4, align 4
  br label %7

7:                                                ; preds = %13, %0
  %8 = load i32, i32* %4, align 4
  %9 = icmp slt i32 %8, ${numberOfCycles}
  br i1 %9, label %10, label %16

10:                                               ; preds = %7
  %11 = load i32, i32* %4, align 4
  %12 = call %struct.JsValue* @"u/cycle"(i32 %11)
  br label %13

13:                                               ; preds = %10
  %14 = load i32, i32* %4, align 4
  %15 = add nsw i32 %14, 1
  store i32 %15, i32* %4, align 4
  br label %7

16:                                               ; preds = %7
  %17 = call i32 @gettimeofday(%struct.timeval* %3, i8* null)
  %18 = getelementptr inbounds %struct.timeval, %struct.timeval* %3, i32 0, i32 1
  %19 = load i32, i32* %18, align 8
  %20 = getelementptr inbounds %struct.timeval, %struct.timeval* %2, i32 0, i32 1
  %21 = load i32, i32* %20, align 8
  %22 = sub nsw i32 %19, %21
  %23 = sitofp i32 %22 to double
  %24 = fdiv double %23, 1.000000e+03
  %25 = getelementptr inbounds %struct.timeval, %struct.timeval* %3, i32 0, i32 0
  %26 = load i64, i64* %25, align 8
  %27 = getelementptr inbounds %struct.timeval, %struct.timeval* %2, i32 0, i32 0
  %28 = load i64, i64* %27, align 8
  %29 = sub nsw i64 %26, %28
  %30 = sitofp i64 %29 to double
  %31 = fmul double %30, 1.000000e+03
  %32 = fadd double %24, %31
  store double %32, double* %5, align 8
  %33 = load double, double* %5, align 8
  %34 = call i32 (i8*, ...) @printf(i8* getelementptr inbounds ([24 x i8], [24 x i8]* @.str_cycle_millis, i64 0, i64 0), double %33)
  ret i32 0
}
    `);

  const optFile = path.resolve(workDir, cyclerFile.replace('.ll', '.Oz.ll'));
  await execLlOpt(cyclerFile, optFile, '-Oz');

  const result = await execLl(optFile);
  console.log(`${'\x1b[34m'}RESULT:\n${result}`, '\x1b[0m');
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
