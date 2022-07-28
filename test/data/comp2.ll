; ModuleID = 'demo'
source_filename = "demo"

%JSV3 = type { i32, i32 }

@a = private constant %JSV3 { i32 3, i32 3 }
@b = private constant %JSV3 { i32 3, i32 4 }
@c = private constant %JSV3 { i32 3, i32 5 }
@fmt = private unnamed_addr constant [19 x i8] c"hello world! %d %d\00", align 1

declare i8* @malloc(i64)

declare i32 @snprintf(i8*, i32, i8*, ...)

declare i32 @puts(i8*)

define %JSV3* @add3(%JSV3* %0, %JSV3* %1, %JSV3* %2) {
entry:
  %3 = getelementptr %JSV3, %JSV3* %0, i32 0, i32 1
  %4 = load i32, i32* %3, align 4
  %5 = getelementptr %JSV3, %JSV3* %1, i32 0, i32 1
  %6 = load i32, i32* %5, align 4
  %7 = getelementptr %JSV3, %JSV3* %2, i32 0, i32 1
  %8 = load i32, i32* %7, align 4
  %9 = add i32 %4, %6
  %10 = call i8* @malloc(i64 ptrtoint (%JSV3* getelementptr (%JSV3, %JSV3* null, i32 1) to i64))
  %11 = bitcast i8* %10 to %JSV3*
  %12 = getelementptr %JSV3, %JSV3* %11, i32 0, i32 0
  store i32 3, i32* %12, align 4
  %13 = getelementptr %JSV3, %JSV3* %11, i32 0, i32 1
  store i32 %9, i32* %13, align 4
  %14 = getelementptr %JSV3, %JSV3* %11, i32 0, i32 1
  %15 = load i32, i32* %14, align 4
  %16 = add i32 %15, %8
  %17 = call i8* @malloc(i64 ptrtoint (%JSV3* getelementptr (%JSV3, %JSV3* null, i32 1) to i64))
  %18 = bitcast i8* %17 to %JSV3*
  %19 = getelementptr %JSV3, %JSV3* %18, i32 0, i32 0
  store i32 3, i32* %19, align 4
  %20 = getelementptr %JSV3, %JSV3* %18, i32 0, i32 1
  store i32 %16, i32* %20, align 4
  ret %JSV3* %18
}

define i32 @main() {
entry:
  %0 = load i32, i32* getelementptr inbounds (%JSV3, %JSV3* @a, i32 0, i32 1), align 4
  %1 = load i32, i32* getelementptr inbounds (%JSV3, %JSV3* @b, i32 0, i32 1), align 4
  %2 = load i32, i32* getelementptr inbounds (%JSV3, %JSV3* @c, i32 0, i32 1), align 4
  %3 = add i32 %0, %1
  %4 = call i8* @malloc(i64 ptrtoint (%JSV3* getelementptr (%JSV3, %JSV3* null, i32 1) to i64))
  %5 = bitcast i8* %4 to %JSV3*
  %6 = getelementptr %JSV3, %JSV3* %5, i32 0, i32 0
  store i32 3, i32* %6, align 4
  %7 = getelementptr %JSV3, %JSV3* %5, i32 0, i32 1
  store i32 %3, i32* %7, align 4
  %8 = getelementptr %JSV3, %JSV3* %5, i32 0, i32 1
  %9 = load i32, i32* %8, align 4
  %10 = add i32 %9, %2
  %11 = alloca i8, i32 1000, align 1
  %12 = call i32 (i8*, i32, i8*, ...) @snprintf(i8* %11, i32 1000, i8* getelementptr inbounds ([19 x i8], [19 x i8]* @fmt, i32 0, i32 0), i32 %9, i32 %10)
  %13 = call i32 @puts(i8* %11)
  ret i32 0
}
