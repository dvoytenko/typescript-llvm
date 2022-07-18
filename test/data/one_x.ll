; ModuleID = 'demo'
source_filename = "demo"

@0 = private unnamed_addr constant [14 x i8] c"add(1, 2): %d\00", align 1

declare i32 @snprintf(i8*, i32, i8*, ...)

declare i32 @puts(i8*)

define i32 @main() {
entry:
  %0 = call i32 @add(i32 1, i32 2)
  %1 = alloca i8, i32 1000, align 1
  %2 = call i32 (i8*, i32, i8*, ...) @snprintf(i8* %1, i32 1000, i8* getelementptr inbounds ([14 x i8], [14 x i8]* @0, i32 0, i32 0), i32 %0)
  %3 = call i32 @puts(i8* %1)
  ret i32 0
}

define i32 @add(i32 %0, i32 %1) {
entry:
  %2 = add i32 %0, %1
  ret i32 %2
}
