; ModuleID = 'demo'
source_filename = "demo"

%Box = type { i32, i32, i32*, i8* }
%"Obj<{ a: number; b: number; }>" = type { %Vtable*, i32, i32 }
%Vtable = type { i32, %Itable** }
%Itable = type { i32, i32* }
%"Obj<{ b: number; a: number; }>" = type { %Vtable*, i32, i32 }
%Obj = type { %Vtable* }

@box_undefined = private constant %Box zeroinitializer
@box_null = private constant %Box { i32 1, i32 0, i32* null, i8* null }
@box_zero = private constant %Box { i32 2, i32 0, i32* null, i8* null }
@box_one = private constant %Box { i32 2, i32 1, i32* null, i8* null }
@box_minus_one = private constant %Box { i32 2, i32 -1, i32* null, i8* null }
@"itable_array<Obj<{ a: number; b: number; }>, Ifc<{ a: number; b: number; }>>" = private constant [2 x i32] [i32 ptrtoint (i32* getelementptr (%"Obj<{ a: number; b: number; }>", %"Obj<{ a: number; b: number; }>"* null, i32 0, i32 1) to i32), i32 ptrtoint (i32* getelementptr (%"Obj<{ a: number; b: number; }>", %"Obj<{ a: number; b: number; }>"* null, i32 0, i32 2) to i32)]
@"itable<Obj<{ a: number; b: number; }>, Ifc<{ a: number; b: number; }>>" = private constant %Itable { i32 1, i32* getelementptr inbounds ([2 x i32], [2 x i32]* @"itable_array<Obj<{ a: number; b: number; }>, Ifc<{ a: number; b: number; }>>", i32 0, i32 0) }
@"itable_array<Obj<{ a: number; b: number; }>>" = private constant [1 x %Itable*] [%Itable* @"itable<Obj<{ a: number; b: number; }>, Ifc<{ a: number; b: number; }>>"]
@"vtable<Obj<{ a: number; b: number; }>>" = private constant %Vtable { i32 1, %Itable** getelementptr inbounds ([1 x %Itable*], [1 x %Itable*]* @"itable_array<Obj<{ a: number; b: number; }>>_upd", i32 0, i32 0) }
@"itable_array<Obj<{ b: number; a: number; }>, Ifc<{ b: number; a: number; }>>" = private constant [2 x i32] [i32 ptrtoint (i32* getelementptr (%"Obj<{ b: number; a: number; }>", %"Obj<{ b: number; a: number; }>"* null, i32 0, i32 1) to i32), i32 ptrtoint (i32* getelementptr (%"Obj<{ b: number; a: number; }>", %"Obj<{ b: number; a: number; }>"* null, i32 0, i32 2) to i32)]
@"itable<Obj<{ b: number; a: number; }>, Ifc<{ b: number; a: number; }>>" = private constant %Itable { i32 2, i32* getelementptr inbounds ([2 x i32], [2 x i32]* @"itable_array<Obj<{ b: number; a: number; }>, Ifc<{ b: number; a: number; }>>", i32 0, i32 0) }
@"itable_array<Obj<{ b: number; a: number; }>>" = private constant [1 x %Itable*] [%Itable* @"itable<Obj<{ b: number; a: number; }>, Ifc<{ b: number; a: number; }>>"]
@"vtable<Obj<{ b: number; a: number; }>>" = private constant %Vtable { i32 2, %Itable** getelementptr inbounds ([2 x %Itable*], [2 x %Itable*]* @"itable_array<Obj<{ b: number; a: number; }>>_upd", i32 0, i32 0) }
@"itable_array<Obj<{ b: number; a: number; }>, Ifc<{ a: number; b: number; }>>" = private constant [2 x i32] [i32 ptrtoint (i32* getelementptr (%"Obj<{ b: number; a: number; }>", %"Obj<{ b: number; a: number; }>"* null, i32 0, i32 2) to i32), i32 ptrtoint (i32* getelementptr (%"Obj<{ b: number; a: number; }>", %"Obj<{ b: number; a: number; }>"* null, i32 0, i32 1) to i32)]
@"itable<Obj<{ b: number; a: number; }>, Ifc<{ a: number; b: number; }>>" = private constant %Itable { i32 1, i32* getelementptr inbounds ([2 x i32], [2 x i32]* @"itable_array<Obj<{ b: number; a: number; }>, Ifc<{ a: number; b: number; }>>", i32 0, i32 0) }
@0 = private unnamed_addr constant [22 x i8] c"add({b: 3, a: 4}): %d\00", align 1
@"itable_array<Obj<{ a: number; b: number; }>>_upd" = private constant [1 x %Itable*] [%Itable* @"itable<Obj<{ a: number; b: number; }>, Ifc<{ a: number; b: number; }>>"]
@"itable_array<Obj<{ b: number; a: number; }>>_upd" = private constant [2 x %Itable*] [%Itable* @"itable<Obj<{ b: number; a: number; }>, Ifc<{ b: number; a: number; }>>", %Itable* @"itable<Obj<{ b: number; a: number; }>, Ifc<{ a: number; b: number; }>>"]

declare i8* @malloc(i64)

define %Itable* @get_itable_from_vtable(%Vtable* %0, i32 %1) {
entry:
  %retval = alloca %Itable*, align 8
  store %Itable* null, %Itable** %retval, align 8
  %2 = getelementptr %Vtable, %Vtable* %0, i32 0, i32 0
  %len = load i32, i32* %2, align 4
  %3 = getelementptr %Vtable, %Vtable* %0, i32 0, i32 1
  %itable_array_ptr = load %Itable**, %Itable*** %3, align 8
  br label %for.start

for.start:                                        ; preds = %entry
  %already_complete = icmp eq i32 %len, 0
  br i1 %already_complete, label %for.end, label %for.body

for.body:                                         ; preds = %for.inc, %for.start
  %index = phi i32 [ 0, %for.start ], [ %inc, %for.inc ]
  %4 = getelementptr %Itable*, %Itable** %itable_array_ptr, i32 %index
  %itable_ptr = load %Itable*, %Itable** %4, align 8
  %5 = getelementptr %Itable, %Itable* %itable_ptr, i32 0, i32 0
  %itable_ifc_id = load i32, i32* %5, align 4
  %found = icmp eq i32 %1, %itable_ifc_id
  br i1 %found, label %for.found, label %for.inc

for.found:                                        ; preds = %for.body
  store %Itable* %itable_ptr, %Itable** %retval, align 8
  br label %for.end

for.inc:                                          ; preds = %for.body
  %inc = add i32 %index, 1
  %exitcond = icmp eq i32 %inc, %len
  br i1 %exitcond, label %for.end, label %for.body

for.end:                                          ; preds = %for.inc, %for.found, %for.start
  %ret = load %Itable*, %Itable** %retval, align 8
  ret %Itable* %ret
}

declare i32 @snprintf(i8*, i32, i8*, ...)

declare i32 @puts(i8*)

; Function Attrs: nofree nosync nounwind readnone speculatable willreturn
declare void @llvm.dbg.value(metadata, metadata, metadata) #0

define i32 @main() {
entry:
  %retval = alloca i32, align 4
  %0 = call i8* @malloc(i64 100)
  %1 = bitcast i8* %0 to %"Obj<{ b: number; a: number; }>"*
  store %"Obj<{ b: number; a: number; }>" { %Vtable* @"vtable<Obj<{ b: number; a: number; }>>", i32 3, i32 4 }, %"Obj<{ b: number; a: number; }>"* %1, align 8
  %cast_to_base_obj = bitcast %"Obj<{ b: number; a: number; }>"* %1 to %Obj*
  %2 = call i32 @add(%Obj* %cast_to_base_obj)
  %3 = alloca i8, i32 1000, align 1
  %4 = call i32 (i8*, i32, i8*, ...) @snprintf(i8* %3, i32 1000, i8* getelementptr inbounds ([22 x i8], [22 x i8]* @0, i32 0, i32 0), i32 %2)
  %5 = call i32 @puts(i8* %3)
  store i32 0, i32* %retval, align 4
  %6 = load i32, i32* %retval, align 4
  ret i32 %6
}

define i32 @add(%Obj* %0) {
entry:
  %retval = alloca i32, align 4
  %1 = getelementptr %Obj, %Obj* %0, i32 0, i32 0
  %vtable_ptr = load %Vtable*, %Vtable** %1, align 8
  %itable_ptr = call %Itable* @get_itable_from_vtable(%Vtable* %vtable_ptr, i32 1)
  %2 = getelementptr %Itable, %Itable* %itable_ptr, i32 0, i32 1
  %offset_array = load i32*, i32** %2, align 8
  %3 = getelementptr i32, i32* %offset_array, i32 0
  %offset = load i32, i32* %3, align 4
  %4 = ptrtoint %Obj* %0 to i64
  %5 = sext i32 %offset to i64
  %offset_on_obj = add i64 %4, %5
  %offset_ptr = inttoptr i64 %offset_on_obj to i32*
  %6 = load i32, i32* %offset_ptr, align 4
  %7 = mul i32 %6, 5
  %8 = getelementptr %Obj, %Obj* %0, i32 0, i32 0
  %vtable_ptr1 = load %Vtable*, %Vtable** %8, align 8
  %itable_ptr2 = call %Itable* @get_itable_from_vtable(%Vtable* %vtable_ptr1, i32 1)
  %9 = getelementptr %Itable, %Itable* %itable_ptr2, i32 0, i32 1
  %offset_array3 = load i32*, i32** %9, align 8
  %10 = getelementptr i32, i32* %offset_array3, i32 1
  %offset4 = load i32, i32* %10, align 4
  %11 = ptrtoint %Obj* %0 to i64
  %12 = sext i32 %offset4 to i64
  %offset_on_obj5 = add i64 %11, %12
  %offset_ptr6 = inttoptr i64 %offset_on_obj5 to i32*
  %13 = load i32, i32* %offset_ptr6, align 4
  %14 = mul i32 %13, 6
  %15 = add i32 %7, %14
  store i32 %15, i32* %retval, align 4
  %16 = load i32, i32* %retval, align 4
  ret i32 %16
}

attributes #0 = { nofree nosync nounwind readnone speculatable willreturn }
