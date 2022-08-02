import llvm from "llvm-bindings";
import { Types } from ".";
import { Debug } from "../debug";
import { Instr } from "../instr";
import { Function } from "../instr/func";
import { I32Type, Pointer, PointerType, Type, Value } from "./base";
import { BoolType } from "./bool";
import { StructFields, StructType, StructValues } from "./struct";

interface Fields<T extends Type> extends StructFields {
  length: I32Type;
  arr: PointerType<T>;
}

interface MutFields extends StructFields {
  size: I32Type;
}

export abstract class NListBase<
  T extends Type,
  F extends StructFields
> extends StructType<Fields<T> & F> {
  constructor(
    context: llvm.LLVMContext,
    name: string,
    public itemType: T,
    fields: F
  ) {
    super(context, `${name}<${itemType.typeName}>`, {
      length: new I32Type(context),
      arr: itemType.pointerOf(),
      ...fields,
    });
  }

  constValueBase(length: number, arr: Pointer<T>, fields: StructValues<F>) {
    return this.createConst({
      length: this.fields.length.constValue(length),
      arr,
      ...fields,
    } as StructValues<Fields<T> & F>);
  }

  itemGep(
    instr: Instr,
    name: string,
    ptr: Pointer<typeof this>,
    index: Value<I32Type>
  ): Pointer<T> {
    const arrPtr = this.load(instr.builder, ptr, "arr");
    return instr.gepArray(name, arrPtr, index);
  }

  instrFindIndex(
    instr: Instr,
    types: Types,
    debug: Debug,
    func: Function<any, any>,
    ptr: Pointer<NListBase<T, {}>>,
    callback: (itemPtr: Pointer<T>) => Value<BoolType>
  ): Value<I32Type> {
    const listType = ptr.type.toType;
    const length = listType.load(instr.builder, ptr, "length");
    const arr = listType.load(instr.builder, ptr, "arr");

    const retval = instr.alloca("found_index", types.i32);
    instr.store(retval, types.i32.constValue(-1));

    const forStartBlock = instr.block(func, "for.start");
    const forBodyBlock = instr.block(func, "for.body");
    const forFoundBlock = instr.block(func, "for.found");
    const forIncBlock = instr.block(func, "for.inc");
    const forEndBlock = instr.block(func, "for.end");

    instr.br(forStartBlock);
    instr.insertPoint(forStartBlock);

    // %exitcond = icmp eq i32 %inc, 10
    const alreadyCompleteCond = instr.icmpEq(
      "already_complete",
      length,
      types.i32.constValue(0)
    );

    // br i1 %exitcond, label %for.end, label %for.body
    instr.condBr(alreadyCompleteCond, forEndBlock, forBodyBlock);

    instr.insertPoint(forBodyBlock);

    // %i.02 = phi i32 [ 0, %for.start ], [ %inc, %for.body ]
    const indexPhi = instr.phiBr("index", types.i32, /* branchCount */ 2);
    indexPhi.addIncoming(types.i32.constValue(0), forStartBlock);

    // get item ptr
    const item_ptr = instr.gepArray("item_ptr", arr, indexPhi.value);

    // Compare.
    const cmp = callback(item_ptr);
    instr.condBr(cmp, forFoundBlock, forIncBlock);

    // Found.
    instr.insertPoint(forFoundBlock);
    instr.store(retval, indexPhi.value);
    instr.br(forEndBlock);

    // Inc.
    instr.insertPoint(forIncBlock);
    // %inc = add nuw nsw i32 %index, 1
    // TODO: nuw, nsw
    const inc = instr.add("inc", indexPhi.value, types.i32.constValue(1));
    // [ %inc, %for.body ]
    indexPhi.addIncoming(inc, forIncBlock);

    // %exitcond = icmp eq i32 %inc, 10
    const exitCond = instr.icmpEq("exit_cond", inc, length);

    // br i1 %exitcond, label %for.end, label %for.body
    instr.condBr(exitCond, forEndBlock, forBodyBlock);

    instr.insertPoint(forEndBlock);
    return instr.load("index", retval);
  }

  instrEquals(
    instr: Instr,
    types: Types,
    func: Function<any, any>,
    ptr1: Pointer<NListBase<T, {}>>,
    ptr2: Pointer<NListBase<T, {}>>,
    callback: (item1: Value<T>, item2: Value<T>) => Value<BoolType>
  ): Value<BoolType> {
    const listType = ptr1.type.toType;
    const retval = instr.alloca("retval", types.bool);
    instr.store(retval, types.bool.constValue(false));

    const forStartBlock = instr.block(func, "for.start");
    const forBodyBlock = instr.block(func, "for.body");
    const forIncBlock = instr.block(func, "for.inc");
    const forEndBlock = instr.block(func, "for.end");
    const retBlock = instr.block(func, "ret");

    const length1 = listType.load(instr.builder, ptr1, "length");
    const length2 = listType.load(instr.builder, ptr1, "length");
    const lengthEqCond = instr.icmpEq("length_eq", length1, length2);
    instr.condBr(lengthEqCond, forStartBlock, retBlock);

    instr.insertPoint(forStartBlock);
    const arr1 = listType.load(instr.builder, ptr1, "arr");
    const arr2 = listType.load(instr.builder, ptr2, "arr");

    // %exitcond = icmp eq i32 %inc, 10
    const alreadyCompleteCond = instr.icmpEq(
      "already_complete",
      length1,
      types.i32.constValue(0)
    );

    // br i1 %exitcond, label %for.end, label %for.body
    instr.condBr(alreadyCompleteCond, forEndBlock, forBodyBlock);

    instr.insertPoint(forBodyBlock);

    // %i.02 = phi i32 [ 0, %for.start ], [ %inc, %for.body ]
    const indexPhi = instr.phiBr("index", types.i32, /* branchCount */ 2);
    indexPhi.addIncoming(types.i32.constValue(0), forStartBlock);

    // get items
    const item1Ptr = instr.gepArray("item1ptr", arr1, indexPhi.value);
    const item2Ptr = instr.gepArray("item2ptr", arr2, indexPhi.value);
    const item1 = instr.load("item1", item1Ptr);
    const item2 = instr.load("item2", item2Ptr);

    // Compare.
    const cmp = callback(item1, item2);
    instr.condBr(cmp, forIncBlock, retBlock);

    // Inc.
    instr.insertPoint(forIncBlock);
    // %inc = add nuw nsw i32 %index, 1
    // TODO: nuw, nsw
    const inc = instr.add("inc", indexPhi.value, types.i32.constValue(1));
    // [ %inc, %for.body ]
    indexPhi.addIncoming(inc, forIncBlock);

    // %exitcond = icmp eq i32 %inc, 10
    const exitCond = instr.icmpEq("exit_cond", inc, length1);

    // br i1 %exitcond, label %for.end, label %for.body
    instr.condBr(exitCond, forEndBlock, forBodyBlock);

    // Finish comparisson and all items are equal.
    instr.insertPoint(forEndBlock);
    instr.store(retval, types.bool.constValue(true));
    instr.br(retBlock);

    instr.insertPoint(retBlock);
    return instr.load("index", retval);
  }
}

export class NList<T extends Type> extends NListBase<T, {}> {
  constructor(context: llvm.LLVMContext, itemType: T) {
    super(context, "NList", itemType, {});
  }

  constValue(length: number, arr: Pointer<T>) {
    return this.constValueBase(length, arr, {});
  }

  constr(instr: Instr, types: Types, ptr: Pointer<typeof this>) {
    const arrPtr = instr.malloc(
      "f_arr",
      this.fields.arr.toType,
      // QQQ: is there such a thing in a 0-length pointer?
      types.i64.constValue(0)
    );
    this.storeStruct(instr.builder, ptr, {
      length: types.i32.constValue(0),
      arr: arrPtr,
    });
  }
}

export class NMutList<T extends Type> extends NListBase<T, MutFields> {
  constructor(context: llvm.LLVMContext, itemType: T) {
    super(context, "NMutList", itemType, {
      size: new I32Type(context),
    });
  }

  constr(instr: Instr, types: Types, ptr: Pointer<typeof this>, iniSize = 10) {
    const arrPtr = instr.malloc(
      "f_arr",
      this.fields.arr.toType,
      types.i64.constValue(iniSize)
    );
    this.storeStruct(instr.builder, ptr, {
      length: types.i32.constValue(0),
      size: types.i32.constValue(iniSize),
      arr: arrPtr,
    });
  }

  initInst(
    instr: Instr,
    types: Types,
    ptr: Pointer<typeof this>,
    iniSize: number
  ) {
    const arr = instr.malloc(
      "mut_list_arr",
      this.itemType,
      types.i64.constValue(iniSize)
    );

    this.storeStruct(instr.builder, ptr, {
      length: types.i32.constValue(0),
      size: types.i32.constValue(iniSize),
      arr,
    });
  }

  createInst(
    instr: Instr,
    types: Types,
    iniSize: number
  ): Pointer<typeof this> {
    const ptr = instr.malloc("mut_list", this);
    this.initInst(instr, types, ptr, iniSize);
    return ptr;
  }

  appendAlloc(
    instr: Instr,
    types: Types,
    name: string,
    ptr: Pointer<typeof this>
  ): Pointer<T> {
    const length = this.load(instr.builder, ptr, "length");
    const newLength = instr.add("new_length", length, types.i32.constValue(1));
    // TODO: expand if newLength == size.
    this.store(instr.builder, ptr, "length", newLength);
    return this.itemGep(instr, name, ptr, length);
  }
}
