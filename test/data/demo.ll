; ModuleID = 'demo'
source_filename = "demo"

%struct.foo = type { i64, i64 }
@chunky = common dso_local local_unnamed_addr global %struct.foo zeroinitializer, align 8

;@i = private unnamed_addr constant i64* getelementptr inbounds (%struct.foo, %struct.foo* @chunky, i64 0, i32 1)
;@j = private unnamed_addr constant i64 ptrtoint(@i)

@str = private unnamed_addr constant [12 x i8] c"hello wOrld\00", align 1

define i32 @add(i32 %0, i32 %1) {
entry:
  %2 = add i32 %0, %1
  ret i32 %2
}

define i64 @main() {
entry:
  %0 = tail call i32 @puts(i8* nonnull dereferenceable(1) getelementptr inbounds ([12 x i8], [12 x i8]* @str, i64 0, i64 0))
  ;%1 = load i64*, i64** @i, align 8
  ret i64 0
}

declare i32 @puts(i8*)
