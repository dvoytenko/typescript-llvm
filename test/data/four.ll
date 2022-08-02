; ModuleID = 'demo'
source_filename = "demo"

%Box = type { i32, i32, i32*, i8* }
%Vtable = type { i32, %Itable** }
%Itable = type { i32, i32* }
%"Obj<{ a: number; b: number; }>" = type { %Vtable*, i32, i32 }

@box_undefined = private constant %Box zeroinitializer
@box_null = private constant %Box { i32 1, i32 0, i32* null, i8* null }
@box_zero = private constant %Box { i32 2, i32 0, i32* null, i8* null }
@box_one = private constant %Box { i32 2, i32 1, i32* null, i8* null }
@box_minus_one = private constant %Box { i32 2, i32 -1, i32* null, i8* null }
@"Vtable<Obj<{ a: number; b: number; }>>" = private constant %Vtable zeroinitializer
@"itable<Obj<{ a: number; b: number; }>>" = private constant [2 x i32] [i32 ptrtoint (i32* getelementptr (%"Obj<{ a: number; b: number; }>", %"Obj<{ a: number; b: number; }>"* null, i32 0, i32 1) to i32), i32 0]
@0 = private unnamed_addr constant [21 x i8] c"add({a: 3, b: 4): %d\00", align 1

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
  %1 = bitcast i8* %0 to %"Obj<{ a: number; b: number; }>"*
  store %"Obj<{ a: number; b: number; }>" { %Vtable* @"Vtable<Obj<{ a: number; b: number; }>>", i32 3, i32 4 }, %"Obj<{ a: number; b: number; }>"* %1, align 8
  %2 = call i32 @add(%"Obj<{ a: number; b: number; }>"* %1)
  %3 = alloca i8, i32 1000, align 1
  %4 = call i32 (i8*, i32, i8*, ...) @snprintf(i8* %3, i32 1000, i8* getelementptr inbounds ([21 x i8], [21 x i8]* @0, i32 0, i32 0), i32 %2)
  %5 = call i32 @puts(i8* %3)
  store i32 0, i32* %retval, align 4
  %6 = load i32, i32* %retval, align 4
  ret i32 %6
}

define i32 @add(%"Obj<{ a: number; b: number; }>"* %0) {
entry:
  %retval = alloca i32, align 4
  %1 = getelementptr %"Obj<{ a: number; b: number; }>", %"Obj<{ a: number; b: number; }>"* %0, i32 0, i32 0
  %vtable_ptr = load %Vtable*, %Vtable** %1, align 8
  %itable_ptr = call %Itable* @get_itable_from_vtable(%Vtable* %vtable_ptr, i32 1)
  ;, !dbg !1
  ; call void @llvm.dbg.value(metadata %Itable* %itable_ptr, metadata !1, metadata !DIExpression())
  %2 = getelementptr %"Obj<{ a: number; b: number; }>", %"Obj<{ a: number; b: number; }>"* %0, i32 0, i32 1
  %3 = load i32, i32* %2, align 4
  %4 = mul i32 %3, 5
  %5 = getelementptr %"Obj<{ a: number; b: number; }>", %"Obj<{ a: number; b: number; }>"* %0, i32 0, i32 0
  %vtable_ptr1 = load %Vtable*, %Vtable** %5, align 8
  %itable_ptr2 = call %Itable* @get_itable_from_vtable(%Vtable* %vtable_ptr1, i32 1)
  %6 = getelementptr %"Obj<{ a: number; b: number; }>", %"Obj<{ a: number; b: number; }>"* %0, i32 0, i32 2
  %7 = load i32, i32* %6, align 4
  %8 = mul i32 %7, 6
  %9 = add i32 %4, %8
  store i32 %9, i32* %retval, align 4
  %10 = load i32, i32* %retval, align 4
  ret i32 %10
}

attributes #0 = { nofree nosync nounwind readnone speculatable willreturn }

;!1 = metadata !{}
