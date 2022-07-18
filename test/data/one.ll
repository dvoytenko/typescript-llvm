; ModuleID = 'one'
source_filename = "one"

declare i8* @malloc(i64)
declare void @free(i8*)

declare i8* @strcat(i8*, i8*)
declare i8* @strcpy(i8*, i8*)
declare i64 @strlen(i8*)

declare i32 @puts(i8*)
declare i32 @snprintf(i8*, i32, i8*, ...)

@s1 = private unnamed_addr constant [11 x i8] c"add(1, 2):\00", align 1
@frmt_4606706533159743250 = internal constant [3 x i8] c"%d\00"
@s_17934988915447438835 = internal constant [2 x i8] c" \00"

@s2 = private unnamed_addr constant [17 x i8] c"add(1, 2): %d %d\00", align 1

define i8* @.concat(i8* %0, i8* %1) {
  %3 = alloca i8*, align 8
  %4 = alloca i8*, align 8
  %5 = alloca i8*, align 8
  store i8* %0, i8** %4, align 8
  store i8* %1, i8** %3, align 8
  %6 = load i8*, i8** %4, align 8
  %7 = call i64 @strlen(i8* %6)
  %8 = add i64 1, %7
  %9 = call i64 @strlen(i8* getelementptr inbounds ([2 x i8], [2 x i8]* @s_17934988915447438835, i64 0, i64 0))
  %10 = add i64 %8, %9
  %11 = call i8* @malloc(i64 %10)
  %12 = call i8* @strcpy(i8* %11, i8* %6)
  %13 = call i8* @strcat(i8* %12, i8* getelementptr inbounds ([2 x i8], [2 x i8]* @s_17934988915447438835, i64 0, i64 0))
  %14 = load i8*, i8** %3, align 8
  %15 = call i64 @strlen(i8* %11)
  %16 = add i64 1, %15
  %17 = call i64 @strlen(i8* %14)
  %18 = add i64 %16, %17
  %19 = call i8* @malloc(i64 %18)
  %20 = call i8* @strcpy(i8* %19, i8* %11)
  %21 = call i8* @strcat(i8* %20, i8* %14)
  store i8* %19, i8** %5, align 8
  %22 = load i8*, i8** %5, align 8
  ret i8* %22
}

define i32 @add(i32 %0, i32 %1) {
entry:
  %2 = add i32 %0, %1
  ret i32 %2
}

define i64 @main() {
entry:
  %call = call i32 @add(i32 1, i32 2)

  ;%str = alloca i8, i8 20, align 1
  ;%to_str = call i32 (i8*, i32, i8*, ...) @snprintf(i8* %str, i32 50, i8* getelementptr inbounds ([3 x i8], [3 x i8]* @frmt_4606706533159743250, i64 0, i64 0), i32 %call)

  ;%concat = call i8* @.concat(
  ;  i8* nonnull dereferenceable(1) getelementptr inbounds ([11 x i8], [11 x i8]* @s1, i64 0, i64 0),
  ;  i8* %str)
  ;%p3 = tail call i32 @puts(i8* %concat)

  %str = alloca i8, i8 1000, align 1
  %to_str = call i32 (i8*, i32, i8*, ...) @snprintf(i8* %str, i32 1000, i8* getelementptr inbounds ([17 x i8], [17 x i8]* @s2, i64 0, i64 0), i32 %call, i32 17)
  %p3 = call i32 @puts(i8* %str)

  ret i64 0
}
