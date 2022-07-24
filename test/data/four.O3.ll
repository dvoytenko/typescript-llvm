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
add.exit:
  %0 = tail call dereferenceable_or_null(100) i8* @malloc(i64 100)
  %1 = bitcast i8* %0 to %"Obj<{ b: number; a: number; }>"*
  %.repack = getelementptr inbounds %"Obj<{ b: number; a: number; }>", %"Obj<{ b: number; a: number; }>"* %1, i64 0, i32 0
  store %Vtable* @"vtable<Obj<{ b: number; a: number; }>>", %Vtable** %.repack, align 8
  %.repack1 = getelementptr inbounds %"Obj<{ b: number; a: number; }>", %"Obj<{ b: number; a: number; }>"* %1, i64 0, i32 1
  store i32 3, i32* %.repack1, align 8
  %.repack2 = getelementptr inbounds %"Obj<{ b: number; a: number; }>", %"Obj<{ b: number; a: number; }>"* %1, i64 0, i32 2
  store i32 4, i32* %.repack2, align 4
  %2 = ptrtoint i8* %0 to i64
  %offset_on_obj.i = add i64 %2, 12
  %offset_ptr.i = inttoptr i64 %offset_on_obj.i to i32*
  %3 = load i32, i32* %offset_ptr.i, align 4
  %4 = mul i32 %3, 5
  %offset_on_obj5.i = add i64 %2, 8
  %offset_ptr6.i = inttoptr i64 %offset_on_obj5.i to i32*
  %5 = load i32, i32* %offset_ptr6.i, align 4
  %6 = mul i32 %5, 6
  %7 = add i32 %6, %4
  %8 = alloca [1000 x i8], align 1
  %.sub = getelementptr inbounds [1000 x i8], [1000 x i8]* %8, i64 0, i64 0
  %9 = call i32 (i8*, i32, i8*, ...) @snprintf(i8* nonnull %.sub, i32 1000, i8* getelementptr inbounds ([22 x i8], [22 x i8]* @0, i64 0, i64 0), i32 %7)
  %10 = call i32 @puts(i8* nonnull %.sub)
  ret i32 0
}

; Function Attrs: nofree norecurse nosync nounwind readonly
define i32 @add(%Obj* %0) local_unnamed_addr #1 {
entry:
  %1 = getelementptr %Obj, %Obj* %0, i64 0, i32 0
  %vtable_ptr = load %Vtable*, %Vtable** %1, align 8
  %2 = getelementptr %Vtable, %Vtable* %vtable_ptr, i64 0, i32 0
  %len.i = load i32, i32* %2, align 4
  %3 = getelementptr %Vtable, %Vtable* %vtable_ptr, i64 0, i32 1
  %itable_array_ptr.i = load %Itable**, %Itable*** %3, align 8
  %already_complete.i = icmp ne i32 %len.i, 0
  tail call void @llvm.assume(i1 %already_complete.i)
  %itable_ptr.i14 = load %Itable*, %Itable** %itable_array_ptr.i, align 8
  %4 = getelementptr %Itable, %Itable* %itable_ptr.i14, i64 0, i32 0
  %itable_ifc_id.i15 = load i32, i32* %4, align 4
  %found.i16 = icmp eq i32 %itable_ifc_id.i15, 1
  br i1 %found.i16, label %get_itable_from_vtable.exit, label %for.inc.i

for.inc.i:                                        ; preds = %entry, %for.inc.i
  %index.i17 = phi i32 [ %inc.i, %for.inc.i ], [ 0, %entry ]
  %inc.i = add nuw i32 %index.i17, 1
  %exitcond.i = icmp ne i32 %inc.i, %len.i
  tail call void @llvm.assume(i1 %exitcond.i)
  %5 = sext i32 %inc.i to i64
  %6 = getelementptr %Itable*, %Itable** %itable_array_ptr.i, i64 %5
  %itable_ptr.i = load %Itable*, %Itable** %6, align 8
  %7 = getelementptr %Itable, %Itable* %itable_ptr.i, i64 0, i32 0
  %itable_ifc_id.i = load i32, i32* %7, align 4
  %found.i = icmp eq i32 %itable_ifc_id.i, 1
  br i1 %found.i, label %get_itable_from_vtable.exit, label %for.inc.i

get_itable_from_vtable.exit:                      ; preds = %for.inc.i, %entry
  %itable_ptr.i.lcssa = phi %Itable* [ %itable_ptr.i14, %entry ], [ %itable_ptr.i, %for.inc.i ]
  %8 = getelementptr %Itable, %Itable* %itable_ptr.i.lcssa, i64 0, i32 1
  %offset_array = load i32*, i32** %8, align 8
  %offset = load i32, i32* %offset_array, align 4
  %9 = ptrtoint %Obj* %0 to i64
  %10 = sext i32 %offset to i64
  %offset_on_obj = add i64 %10, %9
  %offset_ptr = inttoptr i64 %offset_on_obj to i32*
  %11 = load i32, i32* %offset_ptr, align 4
  br i1 %found.i16, label %get_itable_from_vtable.exit13, label %for.inc.i11

for.inc.i11:                                      ; preds = %get_itable_from_vtable.exit, %for.inc.i11
  %index.i421 = phi i32 [ %inc.i9, %for.inc.i11 ], [ 0, %get_itable_from_vtable.exit ]
  %inc.i9 = add nuw i32 %index.i421, 1
  %exitcond.i10 = icmp ne i32 %inc.i9, %len.i
  tail call void @llvm.assume(i1 %exitcond.i10)
  %12 = sext i32 %inc.i9 to i64
  %13 = getelementptr %Itable*, %Itable** %itable_array_ptr.i, i64 %12
  %itable_ptr.i5 = load %Itable*, %Itable** %13, align 8
  %14 = getelementptr %Itable, %Itable* %itable_ptr.i5, i64 0, i32 0
  %itable_ifc_id.i6 = load i32, i32* %14, align 4
  %found.i7 = icmp eq i32 %itable_ifc_id.i6, 1
  br i1 %found.i7, label %get_itable_from_vtable.exit13, label %for.inc.i11

get_itable_from_vtable.exit13:                    ; preds = %for.inc.i11, %get_itable_from_vtable.exit
  %itable_ptr.i5.lcssa = phi %Itable* [ %itable_ptr.i14, %get_itable_from_vtable.exit ], [ %itable_ptr.i5, %for.inc.i11 ]
  %15 = mul i32 %11, 5
  %16 = getelementptr %Itable, %Itable* %itable_ptr.i5.lcssa, i64 0, i32 1
  %offset_array3 = load i32*, i32** %16, align 8
  %17 = getelementptr i32, i32* %offset_array3, i64 1
  %offset4 = load i32, i32* %17, align 4
  %18 = sext i32 %offset4 to i64
  %offset_on_obj5 = add i64 %18, %9
  %offset_ptr6 = inttoptr i64 %offset_on_obj5 to i32*
  %19 = load i32, i32* %offset_ptr6, align 4
  %20 = mul i32 %19, 6
  %21 = add i32 %20, %15
  ret i32 %21
}

; Function Attrs: inaccessiblememonly nofree nosync nounwind willreturn
declare void @llvm.assume(i1 noundef) #3

attributes #0 = { inaccessiblememonly mustprogress nofree nounwind willreturn }
attributes #1 = { nofree norecurse nosync nounwind readonly }
attributes #2 = { nofree nounwind }
attributes #3 = { inaccessiblememonly nofree nosync nounwind willreturn }
