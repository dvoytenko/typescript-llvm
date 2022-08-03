import llvm from "llvm-bindings";

type IntBits = 8 | 16 | 32 | 64;

export class Type {
  constructor(
    public readonly context: llvm.LLVMContext,
    public readonly llType: llvm.Type
  ) {}

  isA<T extends Type>(other: T): this is T {
    return this instanceof other.constructor;
  }

  isBoxed(): this is BoxedType<any> {
    return (
      typeof (this as unknown as BoxedType<any>).loadUnboxed === "function"
    );
  }

  isPointer(): this is PointerType<any> {
    return false;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  isPointerTo<T extends Type>(type: T | (new () => T)): this is PointerType<T> {
    return false;
  }

  pointerOf(): PointerType<typeof this> {
    return new PointerType(this.context, this);
  }

  pointer(ptr: llvm.Value): Pointer<typeof this> {
    return this.pointerOf().create(ptr);
  }

  get typeName(): string {
    return this.constructor.name.toLowerCase().replace("type", "");
  }

  // TODO: move to instr
  sizeof(builder: llvm.IRBuilder): Value<I64Type> {
    // TODO: resolve types/consts via types/gen?
    const arrayType = llvm.PointerType.get(this.llType, 0);
    const gep = builder.CreateGEP(
      this.llType,
      llvm.Constant.getNullValue(arrayType),
      [builder.getInt32(1)],
      `${this.typeName}_sizeof_ptr`
    );
    const intVal = builder.CreatePtrToInt(
      gep,
      builder.getInt64Ty(),
      `${this.typeName}_sizeof`
    );
    return new Value(new I64Type(this.context), intVal);
  }

  castFrom(value: Pointer<Type>): Pointer<typeof this> {
    return new Pointer(this, value.llValue);
  }
}

export interface BoxedType<BT extends Type> {
  unboxedType: BT;
  loadUnboxed(builder: llvm.IRBuilder, ptr: Pointer<typeof this>): Value<BT>;
  storeBoxed(
    builder: llvm.IRBuilder,
    ptr: Pointer<typeof this>,
    value: Value<BT>
  );
}

export class Value<T extends Type> {
  constructor(public type: T, public llValue: llvm.Value) {}

  isConst(): this is ConstValue<T> {
    return false;
  }

  isA<T extends Type>(other: T): this is Value<T> {
    return this.type.isA(other);
  }

  isPointer(): this is Pointer<any> {
    return this.type.isPointer();
  }

  isPointerTo<T extends Type>(type: T | (new () => T)): this is Pointer<T> {
    return this.type.isPointerTo(type);
  }
}

export class ConstValue<T extends Type> extends Value<T> {
  constructor(type: T, public llValue: llvm.Constant) {
    super(type, llValue);
  }

  isConst(): this is ConstValue<T> {
    return true;
  }
}

export class PointerType<T extends Type> extends Type {
  static of<T extends Type>(type: T): PointerType<T> {
    // TODO: singleton
    return new PointerType<T>(type.context, type);
  }

  constructor(context: llvm.LLVMContext, public readonly toType: T) {
    super(context, llvm.PointerType.get(toType.llType, 0));
  }

  override get typeName(): string {
    return `ptr_${this.toType.typeName}`;
  }

  override isA<T extends Type>(other: T): this is T {
    if (!super.isA(other)) {
      return false;
    }
    return this.toType.isA((other as unknown as PointerType<any>).toType);
  }

  override isPointer(): boolean {
    return true;
  }

  override isPointerTo<T extends Type>(
    type: T | (new () => T)
  ): this is PointerType<T> {
    if (typeof type === "function") {
      return this.toType instanceof type;
    }
    return this.toType.isA(type);
  }

  create(ptr: llvm.Value): Pointer<T> {
    return new Pointer(this.toType, ptr);
  }

  nullptr(): Pointer<T> {
    return this.create(llvm.ConstantPointerNull.get(this.llType));
  }
}

export class Pointer<T extends Type> extends Value<PointerType<T>> {
  constructor(toType: T, ptr: llvm.Value) {
    super(PointerType.of(toType), ptr);
  }
}

export class VoidType extends Type {
  constructor(context: llvm.LLVMContext) {
    super(context, llvm.Type.getVoidTy(context));
  }
}

export class IntType<B extends IntBits> extends Type {
  constructor(context: llvm.LLVMContext, public readonly bits: B) {
    super(context, llvm.IntegerType.get(context, bits));
  }

  constValue(v: number): ConstValue<typeof this> {
    return new ConstValue(this, llvm.ConstantInt.get(this.llType, v));
  }
}

export class I8Type extends IntType<8> {
  constructor(context: llvm.LLVMContext) {
    super(context, 8);
  }
}

export class I32Type extends IntType<32> {
  constructor(context: llvm.LLVMContext) {
    super(context, 32);
  }
}

export class I64Type extends IntType<64> {
  constructor(context: llvm.LLVMContext) {
    super(context, 64);
  }
}
