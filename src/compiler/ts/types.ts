import llvm from "llvm-bindings";
import ts from "typescript";
import { CompilerContext } from "../context";
import { Types } from "../types";
import { PointerType, Type } from "../types/base";
import { JsValueType } from "../types/jsvalue";

export function tsToGTypeUnboxed(
  tsType: ts.Type,
  context: CompilerContext
): Type {
  const type = tsToGType(tsType, context);
  if (type.toType.isBoxed() && !tsType.isUnionOrIntersection()) {
    return type.toType.unboxedType;
  }
  return type;
}

export function tsToGType(
  tsType: ts.Type,
  context: CompilerContext
): PointerType<JsValueType<any, any>> {
  const { types } = context;
  logType(tsType, context);

  if (tsType.pattern) {
    throw new Error(`ts.Type.pattern not supported: ${tsType.pattern}`);
  }

  if (tsType.isIntersection()) {
    throw new Error("Not supported isIntersection");
  }
  // if (tsType.isUnionOrIntersection()) {
  //   throw new Error('Not supported isUnionOrIntersection');
  // }
  if (tsType.isLiteral()) {
    throw new Error("Not supported isLiteral");
  }
  if (tsType.isStringLiteral()) {
    throw new Error("Not supported isStringLiteral");
  }
  if (tsType.isNumberLiteral()) {
    throw new Error("Not supported isNumberLiteral");
  }
  if (tsType.isIndexType()) {
    throw new Error("Not supported isIndexType");
  }
  if (tsType.isClass()) {
    throw new Error("Not supported isClass");
  }
  if (tsType.isClassOrInterface()) {
    throw new Error("Not supported isClassOrInterface");
  }
  // if (tsType.isTypeParameter()) {
  //   throw new Error('Not supported isTypeParameter');
  // }

  if (tsType.isUnion()) {
    return types.jsValue.pointerOf();
  }

  let flags: number = tsType.flags;

  if (flags & ts.TypeFlags.Number) {
    flags &= ~ts.TypeFlags.Number;
    if (flags !== 0) {
      throw new Error(`not all flags picked up: ${flags} ${flags.toString(2)}`);
    }
    return types.jsNumber.pointerOf();
  }

  /* type: number
     flags: 8

        Number (2 ^ 3)
        PossiblyFalsy
        Intrinsic
        Primitive
        NumberLike
        DefinitelyNonNullable
        DisjointDomains
        Singleton
        Narrowable
        IncludesMask     
   */

  /* type: number|null
     flags: 1048576
        Union (2 ^ 20)
        UnionOrIntersection
        StructuredType
        StructuredOrInstantiable
        ObjectFlagsType
        Narrowable
        IncludesMask     

     objectFlags: 32768
        PrimitiveUnion (2 ^ 15)
  */

  return types.jsValue.pointerOf();
}

function logType(tsType: ts.Type, { checker }: CompilerContext) {
  // console.log('QQQQ: TYPE: ', tsType);
  console.log("QQQQ: TYPE FLAGS: ", {
    flags: tsType.getFlags(),
    symbol: tsType.getSymbol()
      ? checker.symbolToString(tsType.getSymbol()!)
      : null,
    // toString, toFixed, ...
    properties: tsType
      .getProperties()
      .map((prop) => checker.symbolToString(prop)),
    // toString, toFixed, ...
    apparentProperties: tsType
      .getApparentProperties()
      .map((prop) => checker.symbolToString(prop)),
    // []
    callSignatures: tsType
      .getCallSignatures()
      .map((sig) => checker.signatureToString(sig)),
    // []
    constructSignatures: tsType
      .getConstructSignatures()
      .map((sig) => checker.signatureToString(sig)),
    // null
    stringIndexType: tsType.getStringIndexType()
      ? checker.typeToString(tsType.getStringIndexType()!)
      : null,
    // null
    numberIndexType: tsType.getNumberIndexType()
      ? checker.typeToString(tsType.getNumberIndexType()!)
      : null,
    // null
    baseTypes: tsType.getBaseTypes()
      ? tsType.getBaseTypes()!.map((t) => checker.typeToString(t))
      : null,
    // number
    nonNullableType: checker.typeToString(tsType.getNonNullableType()),
    // null
    constraint: tsType.getConstraint()
      ? checker.typeToString(tsType.getConstraint()!)
      : null,
    // null
    def: tsType.getDefault()
      ? checker.typeToString(tsType.getDefault()!)
      : null,

    // false
    isUnion: tsType.isUnion(),
    // false
    isIntersection: tsType.isIntersection(),
    // false
    isUnionOrIntersection: tsType.isUnionOrIntersection(),
    // false
    isLiteral: tsType.isLiteral(),
    // false
    isStringLiteral: tsType.isStringLiteral(),
    // false
    isNumberLiteral: tsType.isNumberLiteral(),
    // false
    isTypeParameter: tsType.isTypeParameter(),
    // false
    isClassOrInterface: tsType.isClassOrInterface(),
    // false
    isClass: tsType.isClass(),
    // false
    isIndexType: tsType.isIndexType(),
  });
}
