; ModuleID = 'demo'
source_filename = "demo"

%JSV1 = type { i32 }
%JSV4 = type { i32, %"NList<i8>" }
%"NList<i8>" = type { i32, i8* }
%JSV = type { i32 }
%JSV3 = type { i32, i32 }
%JsvMap = type { %"NMutList<jsvmap.entry>" }
%"NMutList<jsvmap.entry>" = type { i32, %JsvMap.Entry*, i32 }
%JsvMap.Entry = type { %JSV4*, %JSV* }
%JSV8 = type { i32, %JsvMap }

@fmt.jsnull = private unnamed_addr constant [10 x i8] c"JSV<null>\00", align 1
@fmt.jsnum = private unnamed_addr constant [15 x i8] c"JSV<number %d>\00", align 1
@fmt.jsv = private unnamed_addr constant [7 x i8] c"JSV<?>\00", align 1
@jsnull = private constant %JSV1 { i32 1 }
@fmt = private unnamed_addr constant [11 x i8] c"BEFORE OLE\00", align 1
@jss = private unnamed_addr constant [2 x i8] c"a\00", align 1
@jss.1 = private constant %JSV4 { i32 4, %"NList<i8>" { i32 1, i8* getelementptr inbounds ([2 x i8], [2 x i8]* @jss, i32 0, i32 0) } }
@jss.2 = private unnamed_addr constant [2 x i8] c"b\00", align 1
@jss.3 = private constant %JSV4 { i32 4, %"NList<i8>" { i32 1, i8* getelementptr inbounds ([2 x i8], [2 x i8]* @jss.2, i32 0, i32 0) } }
@fmt.4 = private unnamed_addr constant [10 x i8] c"AFTER OLE\00", align 1
@fmt.5 = private unnamed_addr constant [21 x i8] c"add({a: 3, b: 4): %s\00", align 1
@jss.6 = private unnamed_addr constant [2 x i8] c"a\00", align 1
@jss.7 = private constant %JSV4 { i32 4, %"NList<i8>" { i32 1, i8* getelementptr inbounds ([2 x i8], [2 x i8]* @jss.6, i32 0, i32 0) } }
@jss.8 = private unnamed_addr constant [2 x i8] c"b\00", align 1
@jss.9 = private constant %JSV4 { i32 4, %"NList<i8>" { i32 1, i8* getelementptr inbounds ([2 x i8], [2 x i8]* @jss.8, i32 0, i32 0) } }

declare i8* @malloc(i64)

declare i32 @snprintf(i8*, i32, i8*, ...)

declare i32 @puts(i8*)

define i8* @debug_jsv(%JSV* %0) {
entry:
  %jsv_jsType_ptr = getelementptr %JSV, %JSV* %0, i32 0, i32 0
  %jsType = load i32, i32* %jsv_jsType_ptr, align 4
  %s_ptr = call i8* @malloc(i64 1000)
  switch i32 %jsType, label %jsunk [
    i32 1, label %jsnull
    i32 3, label %jsnum
  ]

jsnull:                                           ; preds = %entry
  ret i8* getelementptr inbounds ([10 x i8], [10 x i8]* @fmt.jsnull, i32 0, i32 0)

jsnum:                                            ; preds = %entry
  %jsn = bitcast %JSV* %0 to %JSV3*
  %jsv3_value_ptr = getelementptr %JSV3, %JSV3* %jsn, i32 0, i32 1
  %value = load i32, i32* %jsv3_value_ptr, align 4
  %deb = call i32 (i8*, i32, i8*, ...) @snprintf(i8* %s_ptr, i32 1000, i8* getelementptr inbounds ([15 x i8], [15 x i8]* @fmt.jsnum, i32 0, i32 0), i32 %value)
  ret i8* %s_ptr

jsunk:                                            ; preds = %entry
  ret i8* getelementptr inbounds ([7 x i8], [7 x i8]* @fmt.jsv, i32 0, i32 0)
}

define %JSV* @"jslib/add"(%JSV* %0, %JSV* %1) {
entry:
  %jsv_jsType_ptr = getelementptr %JSV, %JSV* %0, i32 0, i32 0
  %jsType = load i32, i32* %jsv_jsType_ptr, align 4
  %jsv_jsType_ptr1 = getelementptr %JSV, %JSV* %1, i32 0, i32 0
  %jsType2 = load i32, i32* %jsv_jsType_ptr1, align 4
  %is_num_a = icmp eq i32 %jsType, 3
  %is_num_b = icmp eq i32 %jsType2, 3
  br i1 %is_num_a, label %num1, label %unk

num1:                                             ; preds = %entry
  br i1 %is_num_b, label %num2, label %unk

num2:                                             ; preds = %num1
  %jsn_a = bitcast %JSV* %0 to %JSV3*
  %jsn_b = bitcast %JSV* %1 to %JSV3*
  %jsv3_value_ptr = getelementptr %JSV3, %JSV3* %jsn_a, i32 0, i32 1
  %value = load i32, i32* %jsv3_value_ptr, align 4
  %jsv3_value_ptr3 = getelementptr %JSV3, %JSV3* %jsn_b, i32 0, i32 1
  %value4 = load i32, i32* %jsv3_value_ptr3, align 4
  %sum = add i32 %value, %value4
  %jsn_sum_ptr = call i8* @malloc(i64 ptrtoint (%JSV3* getelementptr (%JSV3, %JSV3* null, i32 1) to i64))
  %jsn_sum = bitcast i8* %jsn_sum_ptr to %JSV3*
  %jsv3_jsType_ptr = getelementptr %JSV3, %JSV3* %jsn_sum, i32 0, i32 0
  store i32 3, i32* %jsv3_jsType_ptr, align 4
  %jsv3_value_ptr5 = getelementptr %JSV3, %JSV3* %jsn_sum, i32 0, i32 1
  store i32 %sum, i32* %jsv3_value_ptr5, align 4
  %sum_jsv = bitcast %JSV3* %jsn_sum to %JSV*
  ret %JSV* %sum_jsv

unk:                                              ; preds = %num1, %entry
  ret %JSV* bitcast (%JSV1* @jsnull to %JSV*)
}

define i1 @"jslib/stricteq"(%JSV* %0, %JSV* %1) {
entry:
  %jsv_jsType_ptr = getelementptr %JSV, %JSV* %0, i32 0, i32 0
  %jsType = load i32, i32* %jsv_jsType_ptr, align 4
  %jsv_jsType_ptr1 = getelementptr %JSV, %JSV* %1, i32 0, i32 0
  %jsType2 = load i32, i32* %jsv_jsType_ptr1, align 4
  %is_same_jstype = icmp eq i32 %jsType, %jsType2
  br i1 %is_same_jstype, label %same_jstype, label %false

false:                                            ; preds = %entry
  ret i1 false

same_jstype:                                      ; preds = %entry
  ret i1 false
}

define i1 @"jslib/JsString/equals"(%JSV4* %0, %JSV4* %1) {
entry:
  %jsv4_chars_ptr = getelementptr %JSV4, %JSV4* %0, i32 0, i32 1
  %jsv4_chars_ptr1 = getelementptr %JSV4, %JSV4* %1, i32 0, i32 1
  %retval = alloca i1, align 1
  store i1 false, i1* %retval, align 1
  %"nlist<i8>_length_ptr" = getelementptr %"NList<i8>", %"NList<i8>"* %jsv4_chars_ptr, i32 0, i32 0
  %length = load i32, i32* %"nlist<i8>_length_ptr", align 4
  %"nlist<i8>_length_ptr2" = getelementptr %"NList<i8>", %"NList<i8>"* %jsv4_chars_ptr, i32 0, i32 0
  %length3 = load i32, i32* %"nlist<i8>_length_ptr2", align 4
  %length_eq = icmp eq i32 %length, %length3
  br i1 %length_eq, label %for.start, label %ret

for.start:                                        ; preds = %entry
  %"nlist<i8>_arr_ptr" = getelementptr %"NList<i8>", %"NList<i8>"* %jsv4_chars_ptr, i32 0, i32 1
  %arr = load i8*, i8** %"nlist<i8>_arr_ptr", align 8
  %"nlist<i8>_arr_ptr4" = getelementptr %"NList<i8>", %"NList<i8>"* %jsv4_chars_ptr1, i32 0, i32 1
  %arr5 = load i8*, i8** %"nlist<i8>_arr_ptr4", align 8
  %already_complete = icmp eq i32 %length, 0
  br i1 %already_complete, label %for.end, label %for.body

for.body:                                         ; preds = %for.inc, %for.start
  %index = phi i32 [ 0, %for.start ], [ %inc, %for.inc ]
  %item1ptr = getelementptr i8, i8* %arr, i32 %index
  %item2ptr = getelementptr i8, i8* %arr5, i32 %index
  %item1 = load i8, i8* %item1ptr, align 1
  %item2 = load i8, i8* %item2ptr, align 1
  %eq = icmp eq i8 %item1, %item2
  br i1 %eq, label %for.inc, label %ret

for.inc:                                          ; preds = %for.body
  %inc = add i32 %index, 1
  %exit_cond = icmp eq i32 %inc, %length
  br i1 %exit_cond, label %for.end, label %for.body

for.end:                                          ; preds = %for.inc, %for.start
  store i1 true, i1* %retval, align 1
  br label %ret

ret:                                              ; preds = %for.end, %for.body, %entry
  %index6 = load i1, i1* %retval, align 1
  ret i1 %index6
}

define %JSV* @"jslib/JsvMap/get"(%JsvMap* %0, %JSV4* %1) {
entry:
  %jsvmap_entries_ptr = getelementptr %JsvMap, %JsvMap* %0, i32 0, i32 0
  %"nmutlist<jsvmap.entry>_length_ptr" = getelementptr %"NMutList<jsvmap.entry>", %"NMutList<jsvmap.entry>"* %jsvmap_entries_ptr, i32 0, i32 0
  %length = load i32, i32* %"nmutlist<jsvmap.entry>_length_ptr", align 4
  %"nmutlist<jsvmap.entry>_arr_ptr" = getelementptr %"NMutList<jsvmap.entry>", %"NMutList<jsvmap.entry>"* %jsvmap_entries_ptr, i32 0, i32 1
  %arr = load %JsvMap.Entry*, %JsvMap.Entry** %"nmutlist<jsvmap.entry>_arr_ptr", align 8
  %found_index = alloca i32, align 4
  store i32 -1, i32* %found_index, align 4
  br label %for.start

for.start:                                        ; preds = %entry
  %already_complete = icmp eq i32 %length, 0
  br i1 %already_complete, label %for.end, label %for.body

for.body:                                         ; preds = %for.inc, %for.start
  %index = phi i32 [ 0, %for.start ], [ %inc, %for.inc ]
  %item_ptr = getelementptr %JsvMap.Entry, %JsvMap.Entry* %arr, i32 %index
  %jsvmap.entry_key_ptr = getelementptr %JsvMap.Entry, %JsvMap.Entry* %item_ptr, i32 0, i32 0
  %key = load %JSV4*, %JSV4** %jsvmap.entry_key_ptr, align 8
  %str_eq = call i1 @"jslib/JsString/equals"(%JSV4* %1, %JSV4* %key)
  br i1 %str_eq, label %for.found, label %for.inc

for.found:                                        ; preds = %for.body
  store i32 %index, i32* %found_index, align 4
  br label %for.end

for.inc:                                          ; preds = %for.body
  %inc = add i32 %index, 1
  %exit_cond = icmp eq i32 %inc, %length
  br i1 %exit_cond, label %for.end, label %for.body

for.end:                                          ; preds = %for.inc, %for.found, %for.start
  %index1 = load i32, i32* %found_index, align 4
  %is_not_found = icmp eq i32 %index1, -1
  br i1 %is_not_found, label %notfound, label %found

found:                                            ; preds = %for.end
  %"nmutlist<jsvmap.entry>_arr_ptr2" = getelementptr %"NMutList<jsvmap.entry>", %"NMutList<jsvmap.entry>"* %jsvmap_entries_ptr, i32 0, i32 1
  %arr3 = load %JsvMap.Entry*, %JsvMap.Entry** %"nmutlist<jsvmap.entry>_arr_ptr2", align 8
  %index_ptr = getelementptr %JsvMap.Entry, %JsvMap.Entry* %arr3, i32 %index1
  %jsvmap.entry_value_ptr = getelementptr %JsvMap.Entry, %JsvMap.Entry* %index_ptr, i32 0, i32 1
  %value = load %JSV*, %JSV** %jsvmap.entry_value_ptr, align 8
  ret %JSV* %value

notfound:                                         ; preds = %for.end
  ret %JSV* bitcast (%JSV1* @jsnull to %JSV*)
}

define i32 @"jslib/JsvMap/set"(%JsvMap* %0, %JSV4* %1, %JSV* %2) {
entry:
  %jsvmap_entries_ptr = getelementptr %JsvMap, %JsvMap* %0, i32 0, i32 0
  %"nmutlist<jsvmap.entry>_length_ptr" = getelementptr %"NMutList<jsvmap.entry>", %"NMutList<jsvmap.entry>"* %jsvmap_entries_ptr, i32 0, i32 0
  %length = load i32, i32* %"nmutlist<jsvmap.entry>_length_ptr", align 4
  %"nmutlist<jsvmap.entry>_arr_ptr" = getelementptr %"NMutList<jsvmap.entry>", %"NMutList<jsvmap.entry>"* %jsvmap_entries_ptr, i32 0, i32 1
  %arr = load %JsvMap.Entry*, %JsvMap.Entry** %"nmutlist<jsvmap.entry>_arr_ptr", align 8
  %found_index = alloca i32, align 4
  store i32 -1, i32* %found_index, align 4
  br label %for.start

for.start:                                        ; preds = %entry
  %already_complete = icmp eq i32 %length, 0
  br i1 %already_complete, label %for.end, label %for.body

for.body:                                         ; preds = %for.inc, %for.start
  %index = phi i32 [ 0, %for.start ], [ %inc, %for.inc ]
  %item_ptr = getelementptr %JsvMap.Entry, %JsvMap.Entry* %arr, i32 %index
  %jsvmap.entry_key_ptr = getelementptr %JsvMap.Entry, %JsvMap.Entry* %item_ptr, i32 0, i32 0
  %key = load %JSV4*, %JSV4** %jsvmap.entry_key_ptr, align 8
  %str_eq = call i1 @"jslib/JsString/equals"(%JSV4* %1, %JSV4* %key)
  br i1 %str_eq, label %for.found, label %for.inc

for.found:                                        ; preds = %for.body
  store i32 %index, i32* %found_index, align 4
  br label %for.end

for.inc:                                          ; preds = %for.body
  %inc = add i32 %index, 1
  %exit_cond = icmp eq i32 %inc, %length
  br i1 %exit_cond, label %for.end, label %for.body

for.end:                                          ; preds = %for.inc, %for.found, %for.start
  %index1 = load i32, i32* %found_index, align 4
  %is_not_found = icmp eq i32 %index1, -1
  br i1 %is_not_found, label %notfound, label %found

found:                                            ; preds = %for.end
  %"nmutlist<jsvmap.entry>_arr_ptr2" = getelementptr %"NMutList<jsvmap.entry>", %"NMutList<jsvmap.entry>"* %jsvmap_entries_ptr, i32 0, i32 1
  %arr3 = load %JsvMap.Entry*, %JsvMap.Entry** %"nmutlist<jsvmap.entry>_arr_ptr2", align 8
  %index_ptr = getelementptr %JsvMap.Entry, %JsvMap.Entry* %arr3, i32 %index1
  %jsvmap.entry_value_ptr = getelementptr %JsvMap.Entry, %JsvMap.Entry* %index_ptr, i32 0, i32 1
  store %JSV* %2, %JSV** %jsvmap.entry_value_ptr, align 8
  ret i32 0

notfound:                                         ; preds = %for.end
  %"nmutlist<jsvmap.entry>_length_ptr4" = getelementptr %"NMutList<jsvmap.entry>", %"NMutList<jsvmap.entry>"* %jsvmap_entries_ptr, i32 0, i32 0
  %length5 = load i32, i32* %"nmutlist<jsvmap.entry>_length_ptr4", align 4
  %new_length = add i32 %length5, 1
  %"nmutlist<jsvmap.entry>_length_ptr6" = getelementptr %"NMutList<jsvmap.entry>", %"NMutList<jsvmap.entry>"* %jsvmap_entries_ptr, i32 0, i32 0
  store i32 %new_length, i32* %"nmutlist<jsvmap.entry>_length_ptr6", align 4
  %"nmutlist<jsvmap.entry>_arr_ptr7" = getelementptr %"NMutList<jsvmap.entry>", %"NMutList<jsvmap.entry>"* %jsvmap_entries_ptr, i32 0, i32 1
  %arr8 = load %JsvMap.Entry*, %JsvMap.Entry** %"nmutlist<jsvmap.entry>_arr_ptr7", align 8
  %new_entry_ptr = getelementptr %JsvMap.Entry, %JsvMap.Entry* %arr8, i32 %length5
  %jsvmap.entry_key_ptr9 = getelementptr %JsvMap.Entry, %JsvMap.Entry* %new_entry_ptr, i32 0, i32 0
  store %JSV4* %1, %JSV4** %jsvmap.entry_key_ptr9, align 8
  %jsvmap.entry_value_ptr10 = getelementptr %JsvMap.Entry, %JsvMap.Entry* %new_entry_ptr, i32 0, i32 1
  store %JSV* %2, %JSV** %jsvmap.entry_value_ptr10, align 8
  ret i32 0
}

define i32 @main() {
entry:
  %s = alloca i8, i32 1000, align 1
  %s1 = call i32 (i8*, i32, i8*, ...) @snprintf(i8* %s, i32 1000, i8* getelementptr inbounds ([11 x i8], [11 x i8]* @fmt, i32 0, i32 0))
  %printf = call i32 @puts(i8* %s)
  %jso_ptr = call i8* @malloc(i64 ptrtoint (%JSV8* getelementptr (%JSV8, %JSV8* null, i32 1) to i64))
  %jso = bitcast i8* %jso_ptr to %JSV8*
  %jsn_ptr = call i8* @malloc(i64 ptrtoint (%JSV3* getelementptr (%JSV3, %JSV3* null, i32 1) to i64))
  %jsn = bitcast i8* %jsn_ptr to %JSV3*
  %jsv3_jsType_ptr = getelementptr %JSV3, %JSV3* %jsn, i32 0, i32 0
  store i32 3, i32* %jsv3_jsType_ptr, align 4
  %jsv3_value_ptr = getelementptr %JSV3, %JSV3* %jsn, i32 0, i32 1
  store i32 3, i32* %jsv3_value_ptr, align 4
  %jsv = bitcast %JSV3* %jsn to %JSV*
  %jsv8_map_ptr = getelementptr %JSV8, %JSV8* %jso, i32 0, i32 1
  %map_set = call i32 @"jslib/JsvMap/set"(%JsvMap* %jsv8_map_ptr, %JSV4* @jss.1, %JSV* %jsv)
  %jsn_ptr2 = call i8* @malloc(i64 ptrtoint (%JSV3* getelementptr (%JSV3, %JSV3* null, i32 1) to i64))
  %jsn3 = bitcast i8* %jsn_ptr2 to %JSV3*
  %jsv3_jsType_ptr4 = getelementptr %JSV3, %JSV3* %jsn3, i32 0, i32 0
  store i32 3, i32* %jsv3_jsType_ptr4, align 4
  %jsv3_value_ptr5 = getelementptr %JSV3, %JSV3* %jsn3, i32 0, i32 1
  store i32 4, i32* %jsv3_value_ptr5, align 4
  %jsv6 = bitcast %JSV3* %jsn3 to %JSV*
  %jsv8_map_ptr7 = getelementptr %JSV8, %JSV8* %jso, i32 0, i32 1
  %map_set8 = call i32 @"jslib/JsvMap/set"(%JsvMap* %jsv8_map_ptr7, %JSV4* @jss.3, %JSV* %jsv6)
  %s9 = alloca i8, i32 1000, align 1
  %s10 = call i32 (i8*, i32, i8*, ...) @snprintf(i8* %s9, i32 1000, i8* getelementptr inbounds ([10 x i8], [10 x i8]* @fmt.4, i32 0, i32 0))
  %printf11 = call i32 @puts(i8* %s9)
  %cast = bitcast %JSV8* %jso to %JSV*
  %"u/add_res" = call %JSV* @"u/add"(%JSV* %cast)
  %s_ptr = call i8* @malloc(i64 1000)
  %jsv_deb = call i8* @debug_jsv(%JSV* %"u/add_res")
  %s12 = alloca i8, i32 1000, align 1
  %s13 = call i32 (i8*, i32, i8*, ...) @snprintf(i8* %s12, i32 1000, i8* getelementptr inbounds ([21 x i8], [21 x i8]* @fmt.5, i32 0, i32 0), i8* %jsv_deb)
  %printf14 = call i32 @puts(i8* %s12)
  ret i32 0
}

define %JSV* @"u/add"(%JSV* %0) {
entry:
  %jsv_to_obj = bitcast %JSV* %0 to %JSV8*
  %jsv8_map_ptr = getelementptr %JSV8, %JSV8* %jsv_to_obj, i32 0, i32 1
  %get_map_field = call %JSV* @"jslib/JsvMap/get"(%JsvMap* %jsv8_map_ptr, %JSV4* @jss.7)
  %jsv_to_obj1 = bitcast %JSV* %0 to %JSV8*
  %jsv8_map_ptr2 = getelementptr %JSV8, %JSV8* %jsv_to_obj1, i32 0, i32 1
  %get_map_field3 = call %JSV* @"jslib/JsvMap/get"(%JsvMap* %jsv8_map_ptr2, %JSV4* @jss.9)
  %add_res = call %JSV* @"jslib/add"(%JSV* %get_map_field, %JSV* %get_map_field3)
  ret %JSV* %add_res
}