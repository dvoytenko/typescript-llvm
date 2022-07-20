; ModuleID = 'demo'
source_filename = "demo"

%Box = type { i32, i32 }

@box_undefined = private constant %Box zeroinitializer
@box_null = private constant %Box { i32 1, i32 0 }
@box_zero = private constant %Box { i32 2, i32 0 }
@box_one = private constant %Box { i32 2, i32 1 }
@box_minus_one = private constant %Box { i32 2, i32 -1 }
@0 = private unnamed_addr constant [22 x i8] c"add(1, 2): box<%d,%d>\00", align 1

declare i8* @malloc(i64)

declare i32 @snprintf(i8*, i32, i8*, ...)

declare i32 @puts(i8*)

define i32 @main() {
entry:
  %retval = alloca i32, align 4
  %0 = call i8* @malloc(i64 100)
  %1 = bitcast i8* %0 to %Box*
  store %Box { i32 2, i32 2 }, %Box* %1, align 4
  %2 = call %Box* @add(i32 1, %Box* %1)
  %3 = getelementptr %Box, %Box* %2, i32 0, i32 0
  %4 = load i32, i32* %3, align 4
  %5 = getelementptr %Box, %Box* %2, i32 0, i32 1
  %6 = load i32, i32* %5, align 4
  %7 = alloca i8, i32 1000, align 1
  %8 = call i32 (i8*, i32, i8*, ...) @snprintf(i8* %7, i32 1000, i8* getelementptr inbounds ([22 x i8], [22 x i8]* @0, i32 0, i32 0), i32 %4, i32 %6)
  %9 = call i32 @puts(i8* %7)
  store i32 0, i32* %retval, align 4
  %10 = load i32, i32* %retval, align 4
  ret i32 %10
}

define %Box* @add(i32 %0, %Box* %1) {
entry:
  %retval = alloca %Box*, align 8
  %2 = getelementptr %Box, %Box* %1, i32 0, i32 0
  %3 = load i32, i32* %2, align 4
  %4 = icmp eq i32 %3, 1
  br i1 %4, label %5, label %6

5:                                                ; preds = %entry
  store %Box* @box_null, %Box** %retval, align 8
  br label %6

6:                                                ; preds = %5, %entry
  %7 = getelementptr %Box, %Box* %1, i32 0, i32 1
  %8 = load i32, i32* %7, align 4
  %9 = add i32 %0, %8
  %10 = call i8* @malloc(i64 100)
  %11 = bitcast i8* %10 to %Box*
  %12 = getelementptr %Box, %Box* %11, i32 0, i32 0
  store i32 2, i32* %12, align 4
  %13 = getelementptr %Box, %Box* %11, i32 0, i32 1
  store i32 %9, i32* %13, align 4
  store %Box* %11, %Box** %retval, align 8
  %14 = load %Box*, %Box** %retval, align 8
  ret %Box* %14
}
