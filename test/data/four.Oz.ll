; ModuleID = 'four.ll'
source_filename = "demo"

%"Obj<{ b: number; a: number; }>" = type { %Vtable*, i32, i32 }
%Vtable = type { i32, %Itable** }
%Itable = type { i32, i32* }
%Obj = type { %Vtable* }

@"itable_array<Obj<{ b: number; a: number; }>, Ifc<{ b: number; a: number; }>>" = private constant [2 x i32] [i32 ptrtoint (i32* getelementptr (%"Obj<{ b: number; a: number; }>", %"Obj<{ b: number; a: number; }>"* null, i32 0, i32 1) to i32), i32 ptrtoint (i32* getelementptr (%"Obj<{ b: number; a: number; }>", %"Obj<{ b: number; a: number; }>"* null, i32 0, i32 2) to i32)]
@"itable<Obj<{ b: number; a: number; }>, Ifc<{ b: number; a: number; }>>" = private constant %Itable { i32 2, i32* getelementptr inbounds ([2 x i32], [2 x i32]* @"itable_array<Obj<{ b: number; a: number; }>, Ifc<{ b: number; a: number; }>>", i32 0, i32 0) }
@"vtable<Obj<{ b: number; a: number; }>>" = private constant %Vtable { i32 2, %Itable** getelementptr inbounds ([2 x %Itable*], [2 x %Itable*]* @"itable_array<Obj<{ b: number; a: number; }>>_upd", i32 0, i32 0) }
@"itable_array<Obj<{ b: number; a: number; }>, Ifc<{ a: number; b: number; }>>" = private constant [2 x i32] [i32 ptrtoint (i32* getelementptr (%"Obj<{ b: number; a: number; }>", %"Obj<{ b: number; a: number; }>"* null, i32 0, i32 2) to i32), i32 ptrtoint (i32* getelementptr (%"Obj<{ b: number; a: number; }>", %"Obj<{ b: number; a: number; }>"* null, i32 0, i32 1) to i32)]
@"itable<Obj<{ b: number; a: number; }>, Ifc<{ a: number; b: number; }>>" = private constant %Itable { i32 1, i32* getelementptr inbounds ([2 x i32], [2 x i32]* @"itable_array<Obj<{ b: number; a: number; }>, Ifc<{ a: number; b: number; }>>", i32 0, i32 0) }
@0 = private unnamed_addr constant [22 x i8] c"add({b: 3, a: 4}): %d\00", align 1
@"itable_array<Obj<{ b: number; a: number; }>>_upd" = private constant [2 x %Itable*] [%Itable* @"itable<Obj<{ b: number; a: number; }>, Ifc<{ b: number; a: number; }>>", %Itable* @"itable<Obj<{ b: number; a: number; }>, Ifc<{ a: number; b: number; }>>"]

; Function Attrs: inaccessiblememonly mustprogress nofree nounwind willreturn
declare noalias noundef i8* @malloc(i64 noundef) local_unnamed_addr #0

; Function Attrs: nofree norecurse nosync nounwind readonly
define %Itable* @get_itable_from_vtable(%Vtable* nocapture readonly %0, i32 %1) local_unnamed_addr #1 {
entry:
  %2 = getelementptr %Vtable, %Vtable* %0, i64 0, i32 0
  %len = load i32, i32* %2, align 4
  %3 = getelementptr %Vtable, %Vtable* %0, i64 0, i32 1
  %itable_array_ptr = load %Itable**, %Itable*** %3, align 8
  %already_complete = icmp eq i32 %len, 0
  br i1 %already_complete, label %for.end, label %for.body

for.body:                                         ; preds = %entry, %for.inc
  %index = phi i32 [ %inc, %for.inc ], [ 0, %entry ]
  %4 = sext i32 %index to i64
  %5 = getelementptr %Itable*, %Itable** %itable_array_ptr, i64 %4
  %itable_ptr = load %Itable*, %Itable** %5, align 8
  %6 = getelementptr %Itable, %Itable* %itable_ptr, i64 0, i32 0
  %itable_ifc_id = load i32, i32* %6, align 4
  %found = icmp eq i32 %itable_ifc_id, %1
  br i1 %found, label %for.end, label %for.inc

for.inc:                                          ; preds = %for.body
  %inc = add nuw i32 %index, 1
  %exitcond = icmp eq i32 %inc, %len
  br i1 %exitcond, label %for.end, label %for.body

for.end:                                          ; preds = %for.body, %for.inc, %entry
  %retval.0 = phi %Itable* [ null, %entry ], [ %itable_ptr, %for.body ], [ null, %for.inc ]
  ret %Itable* %retval.0
}

declare i32 @snprintf(i8*, i32, i8*, ...) local_unnamed_addr

; Function Attrs: nofree nounwind
declare noundef i32 @puts(i8* nocapture noundef readonly) local_unnamed_addr #2

define i32 @main() local_unnamed_addr {
entry:
  %0 = tail call dereferenceable_or_null(100) i8* @malloc(i64 100)
  %1 = bitcast i8* %0 to %"Obj<{ b: number; a: number; }>"*
  %.repack = getelementptr inbounds %"Obj<{ b: number; a: number; }>", %"Obj<{ b: number; a: number; }>"* %1, i64 0, i32 0
  store %Vtable* @"vtable<Obj<{ b: number; a: number; }>>", %Vtable** %.repack, align 8
  %.repack1 = getelementptr inbounds %"Obj<{ b: number; a: number; }>", %"Obj<{ b: number; a: number; }>"* %1, i64 0, i32 1
  store i32 3, i32* %.repack1, align 8
  %.repack2 = getelementptr inbounds %"Obj<{ b: number; a: number; }>", %"Obj<{ b: number; a: number; }>"* %1, i64 0, i32 2
  store i32 4, i32* %.repack2, align 4
  %cast_to_base_obj = bitcast i8* %0 to %Obj*
  %2 = tail call i32 @add(%Obj* %cast_to_base_obj)
  %3 = alloca [1000 x i8], align 1
  %.sub = getelementptr inbounds [1000 x i8], [1000 x i8]* %3, i64 0, i64 0
  %4 = call i32 (i8*, i32, i8*, ...) @snprintf(i8* nonnull %.sub, i32 1000, i8* getelementptr inbounds ([22 x i8], [22 x i8]* @0, i64 0, i64 0), i32 %2)
  %5 = call i32 @puts(i8* nonnull %.sub)
  ret i32 0
}

; Function Attrs: nofree norecurse nosync nounwind readonly
define i32 @add(%Obj* %0) local_unnamed_addr #1 {
entry:
  %1 = getelementptr %Obj, %Obj* %0, i64 0, i32 0
  %vtable_ptr = load %Vtable*, %Vtable** %1, align 8
  %itable_ptr = tail call %Itable* @get_itable_from_vtable(%Vtable* %vtable_ptr, i32 1)
  %2 = getelementptr %Itable, %Itable* %itable_ptr, i64 0, i32 1
  %offset_array = load i32*, i32** %2, align 8
  %offset = load i32, i32* %offset_array, align 4
  %3 = ptrtoint %Obj* %0 to i64
  %4 = sext i32 %offset to i64
  %offset_on_obj = add i64 %4, %3
  %offset_ptr = inttoptr i64 %offset_on_obj to i32*
  %5 = load i32, i32* %offset_ptr, align 4
  %6 = mul i32 %5, 5
  %7 = getelementptr i32, i32* %offset_array, i64 1
  %offset4 = load i32, i32* %7, align 4
  %8 = sext i32 %offset4 to i64
  %offset_on_obj5 = add i64 %8, %3
  %offset_ptr6 = inttoptr i64 %offset_on_obj5 to i32*
  %9 = load i32, i32* %offset_ptr6, align 4
  %10 = mul i32 %9, 6
  %11 = add i32 %10, %6
  ret i32 %11
}

attributes #0 = { inaccessiblememonly mustprogress nofree nounwind willreturn }
attributes #1 = { nofree norecurse nosync nounwind readonly }
attributes #2 = { nofree nounwind }
