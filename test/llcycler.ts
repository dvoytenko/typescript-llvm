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

export function buildCycler(numberOfCycles: number, code: string) {
  // TODO: very fragile. redo via linker. pass number of cycles as an arg.
  /*
    %struct.timeval = type { i64, i32 }
    declare i32 @gettimeofday(%struct.timeval*, i8*)

    define double @currentTimeMillis() {
      %1 = alloca %struct.timeval, align 8
      %2 = call i32 @gettimeofday(%struct.timeval* %1, i8* null)
      %3 = getelementptr inbounds %struct.timeval, %struct.timeval* %1, i32 0, i32 1
      %4 = load i32, i32* %3, align 8
      %5 = sitofp i32 %4 to double
      %6 = fdiv double %5, 1.000000e+03
      %7 = getelementptr inbounds %struct.timeval, %struct.timeval* %1, i32 0, i32 0
      %8 = load i64, i64* %7, align 8
      %9 = sitofp i64 %8 to double
      %10 = fmul double %9, 1.000000e+03
      %11 = fadd double %6, %10
      ret double %11
    }
   */
  return `${code}
@.str_cycle_millis = private unnamed_addr constant [23 x i8] c"Total time = %f millis\\00", align 1
;declare i32 @__snprintf_chk(i8*, i64, i32, i64, i8*, ...)
declare i32 @puts(i8*)

%struct.timeval = type { i64, i32 }
declare i32 @gettimeofday(%struct.timeval*, i8*)

define double @currentTimeMillis() {
  %1 = alloca %struct.timeval, align 8
  %2 = call i32 @gettimeofday(%struct.timeval* %1, i8* null)
  %3 = getelementptr inbounds %struct.timeval, %struct.timeval* %1, i32 0, i32 1
  %4 = load i32, i32* %3, align 8
  %5 = sitofp i32 %4 to double
  %6 = fdiv double %5, 1.000000e+03
  %7 = getelementptr inbounds %struct.timeval, %struct.timeval* %1, i32 0, i32 0
  %8 = load i64, i64* %7, align 8
  %9 = sitofp i64 %8 to double
  %10 = fmul double %9, 1.000000e+03
  %11 = fadd double %6, %10
  ret double %11
}

define i32 @main() {
  %1 = alloca i32, align 4
  %2 = alloca double, align 8
  %3 = alloca i32, align 4
  %4 = alloca double, align 8
  %5 = alloca double, align 8
  %6 = alloca i8*, align 8
  store i32 0, i32* %1, align 4
  %7 = call double @currentTimeMillis()
  store double %7, double* %2, align 8
  store i32 0, i32* %3, align 4
  br label %8

8:                                                ; preds = %14, %0
  %9 = load i32, i32* %3, align 4
  %10 = icmp slt i32 %9, ${numberOfCycles}
  br i1 %10, label %11, label %17

11:                                               ; preds = %8
  %12 = load i32, i32* %3, align 4
  %13 = call %struct.JsValue* @"u/cycle"(i32 %12)
  br label %14

14:                                               ; preds = %11
  %15 = load i32, i32* %3, align 4
  %16 = add nsw i32 %15, 1
  store i32 %16, i32* %3, align 4
  br label %8

17:                                               ; preds = %8
  %18 = call double @currentTimeMillis()
  store double %18, double* %4, align 8
  %19 = load double, double* %4, align 8
  %20 = load double, double* %2, align 8
  %21 = fsub double %19, %20
  store double %21, double* %5, align 8
  %22 = call i8* @malloc(i64 1000) #4
  store i8* %22, i8** %6, align 8
  %23 = load i8*, i8** %6, align 8
  %24 = load i8*, i8** %6, align 8
  %25 = call i64 @llvm.objectsize.i64.p0i8(i8* %24, i1 false, i1 true, i1 false)
  %26 = load double, double* %5, align 8
  %27 = call i32 (i8*, i64, i32, i64, i8*, ...) @__snprintf_chk(i8* %23, i64 1000, i32 0, i64 %25, i8* getelementptr inbounds ([23 x i8], [23 x i8]* @.str_cycle_millis, i64 0, i64 0), double %26)
  %28 = load i8*, i8** %6, align 8
  %29 = call i32 @puts(i8* %28)
  ret i32 0
}
  `;
}
