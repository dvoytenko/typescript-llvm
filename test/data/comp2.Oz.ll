; ModuleID = 'comp2.ll'
source_filename = "demo"

%JSV3 = type { i32, i32 }

@fmt = private unnamed_addr constant [19 x i8] c"hello world! %d %d\00", align 1

; Function Attrs: inaccessiblememonly mustprogress nofree nounwind willreturn
declare noalias noundef i8* @malloc(i64 noundef) local_unnamed_addr #0

declare i32 @snprintf(i8*, i32, i8*, ...) local_unnamed_addr

; Function Attrs: nofree nounwind
declare noundef i32 @puts(i8* nocapture noundef readonly) local_unnamed_addr #1

; Function Attrs: mustprogress nofree nounwind willreturn
define noalias %JSV3* @add3(%JSV3* nocapture readonly %0, %JSV3* nocapture readonly %1, %JSV3* nocapture readonly %2) local_unnamed_addr #2 {
entry:
  %3 = getelementptr %JSV3, %JSV3* %0, i64 0, i32 1
  %4 = load i32, i32* %3, align 4
  %5 = getelementptr %JSV3, %JSV3* %1, i64 0, i32 1
  %6 = load i32, i32* %5, align 4
  %7 = getelementptr %JSV3, %JSV3* %2, i64 0, i32 1
  %8 = load i32, i32* %7, align 4
  %9 = add i32 %6, %4
  %10 = add i32 %9, %8
  %11 = tail call dereferenceable_or_null(8) i8* @malloc(i64 8)
  %12 = bitcast i8* %11 to %JSV3*
  %13 = getelementptr %JSV3, %JSV3* %12, i64 0, i32 0
  store i32 3, i32* %13, align 4
  %14 = getelementptr %JSV3, %JSV3* %12, i64 0, i32 1
  store i32 %10, i32* %14, align 4
  ret %JSV3* %12
}

define i32 @main() local_unnamed_addr {
entry:
  %0 = alloca [1000 x i8], align 1
  %.sub = getelementptr inbounds [1000 x i8], [1000 x i8]* %0, i64 0, i64 0
  %1 = call i32 (i8*, i32, i8*, ...) @snprintf(i8* nonnull %.sub, i32 1000, i8* getelementptr inbounds ([19 x i8], [19 x i8]* @fmt, i64 0, i64 0), i32 7, i32 12)
  %2 = call i32 @puts(i8* nonnull %.sub)
  ret i32 0
}

attributes #0 = { inaccessiblememonly mustprogress nofree nounwind willreturn }
attributes #1 = { nofree nounwind }
attributes #2 = { mustprogress nofree nounwind willreturn }
