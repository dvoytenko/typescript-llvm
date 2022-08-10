export function buildCycler(numberOfCycles: number, code: string) {
  // TODO: very fragile. redo via linker. pass number of cycles as an arg.
  return `${code}

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
  `;
}
