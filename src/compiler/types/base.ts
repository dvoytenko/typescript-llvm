import llvm from "llvm-bindings";

export class Type {
  constructor(
    public readonly context: llvm.LLVMContext,
    public readonly llType: llvm.Type
  ) {}

  get typeName(): string {
    return this.constructor.name.toLowerCase().replace("type", "");
  }

  isA<T extends Type>(other: T): this is T {
    return this.constructor === other.constructor;
  }

  isInheritedFrom<T extends Type>(other: T): this is T {
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

  isPointerTo<T extends Type>(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    type: T | (new (...args: any[]) => T)
  ): this is PointerType<T> {
    return false;
  }

  isPointerToInherited<T extends Type>(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    type: T | (new (...args: any[]) => T)
  ): this is PointerType<T> {
    return false;
  }

  value(llValue: llvm.Value): Value<typeof this> {
    return new Value(this, llValue);
  }

  constValue(llValue: llvm.Constant): ConstValue<typeof this> {
    return new ConstValue(this, llValue);
  }

  pointerOf(): PointerType<typeof this> {
    return new PointerType(this.context, this);
  }

  pointer(ptr: llvm.Value): Pointer<typeof this> {
    return this.pointerOf().create(ptr);
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

export class Value<T extends Type = Type> {
  constructor(public type: T, public llValue: llvm.Value) {}

  isConst(): this is ConstValue<T> {
    return false;
  }

  // TODO: Dangerous API. Can we get rid of it?
  asConst(): ConstValue<T> {
    if (!(this.llValue instanceof llvm.Constant)) {
      throw new Error(
        `${this.llValue} for ${this.type.typeName} is not a constant`
      );
    }
    return new ConstValue<T>(this.type, this.llValue);
  }

  isA<T extends Type>(other: T): this is Value<T> {
    return this.type.isA(other);
  }

  isInheritedFrom<T extends Type>(other: T): this is Value<T> {
    return this.type.isInheritedFrom(other);
  }

  isPointer(): this is Pointer {
    return this.type.isPointer();
  }

  isPointerTo<T extends Type>(
    type: T | (new (...args: any[]) => T)
  ): this is Pointer<T> {
    return this.type.isPointerTo(type);
  }

  isPointerToInherited<T extends Type>(
    type: T | (new (...args: any[]) => T)
  ): this is Pointer<T> {
    return this.type.isPointerToInherited(type);
  }

  isBoxed<T extends Type>(): this is Pointer<T & BoxedType<any>> {
    return this.isPointer() && this.type.toType.isBoxed();
  }
}

export class ConstValue<T extends Type = Type> extends Value<T> {
  constructor(type: T, public llValue: llvm.Constant) {
    super(type, llValue);
  }

  override isConst(): this is ConstValue<T> {
    return true;
  }
}

export class PointerType<T extends Type> extends Type {
  static of<T extends Type>(type: T): PointerType<T> {
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

  override isInheritedFrom<T extends Type>(other: T): this is T {
    if (!super.isInheritedFrom(other)) {
      return false;
    }
    return this.toType.isInheritedFrom(
      (other as unknown as PointerType<any>).toType
    );
  }

  override isPointer(): boolean {
    return true;
  }

  override isPointerTo<T extends Type>(
    type: T | (new () => T)
  ): this is PointerType<T> {
    if (typeof type === "function") {
      return this.toType.constructor === type;
    }
    return this.toType.isA(type);
  }

  override isPointerToInherited<T extends Type>(
    type: T | (new (...args: any[]) => T)
  ): this is PointerType<T> {
    if (typeof type === "function") {
      return this.toType instanceof type;
    }
    return this.toType.isInheritedFrom(type);
  }

  create(ptr: llvm.Value): Pointer<T> {
    return new Pointer(this.toType, ptr);
  }

  nullptr(): Pointer<T> {
    return this.create(llvm.ConstantPointerNull.get(this.llType));
  }
}

export class Pointer<T extends Type = Type> extends Value<PointerType<T>> {
  constructor(toType: T, ptr: llvm.Value) {
    super(PointerType.of(toType), ptr);
  }
}

export class VoidType extends Type {
  constructor(context: llvm.LLVMContext) {
    super(context, llvm.Type.getVoidTy(context));
  }
}
