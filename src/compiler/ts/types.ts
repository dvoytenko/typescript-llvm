/*
Copyright 2022 Google LLC

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    https://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import ts from "typescript";
import { CompilerContext } from "../context";
import { PointerType, Type } from "../types/base";
import { JsValue } from "../types/jsvalue";
import { StructFields } from "../types/struct";

export function tsToTypeUnboxed(
  tsType: ts.Type,
  node: ts.Node,
  context: CompilerContext
): Type {
  const type = tsToType(tsType, node, context);
  if (type.toType.isBoxed() && !tsType.isUnionOrIntersection()) {
    return type.toType.unboxedType;
  }
  return type;
}

export function tsToType(
  tsType: ts.Type,
  node: ts.Node,
  context: CompilerContext
): PointerType<JsValue> {
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

  if (isObjectType(tsType)) {
    flags &= ~ts.TypeFlags.Object;
    if (flags !== 0) {
      throw new Error(`not all flags picked up: ${flags} ${flags.toString(2)}`);
    }

    if (isTypeReference(tsType) && tsType.symbol.name === "Array") {
      // const typeArgs = context.checker.getTypeArguments(tsRefType);
      return types.jsArray.pointerOf();
    }

    // TODO: cleanup. used to be:
    // return context.declObjType(tsType, node).type.pointerOf();
    return types.jsObject.pointerOf();
  }

  /* type: { a: number; b: number; }
     flags: 524288  
        Object (2 ^ 19)
        DefinitelyNonNullable
        StructuredType
        StructuredOrInstantiable
        ObjectFlagsType
        Narrowable
        IncludesMask
        NotPrimitiveUnion    
     
     objectFlags: 139408
        Anonymous (2 ^ 4)
        ObjectLiteral (2 ^ 7)
        FreshLiteral (2 ^ 13)
        ContainsObjectOrArrayLiteral (2 ^ 17)
        RequiresWidening
        PropagatingFlags
        ObjectTypeKindMask        
   */

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

  /* type: any[]
      flags: 524288
        Object (2 ^ 19)
        DefinitelyNonNullable
        StructuredType
        StructuredOrInstantiable
        ObjectFlagsType
        Narrowable
        IncludesMask
        NotPrimitiveUnion
      
      objectFlags: 4
        Reference (2 ^ 2)
        ObjectTypeKindMask        
  */

  return types.jsValue.pointerOf();
}

function isObjectType(tsType: ts.Type): tsType is ts.ObjectType {
  return (tsType.flags & ts.TypeFlags.Object) !== 0;
}

function isTypeReference(tsType: ts.Type): tsType is ts.TypeReference {
  return (
    isObjectType(tsType) &&
    (tsType.objectFlags & ts.ObjectFlags.Reference) !== 0
  );
}

export function tsToStructFields(
  tsType: ts.Type,
  node: ts.Node,
  compilerContext: CompilerContext
): StructFields {
  const { checker } = compilerContext;
  const shape: StructFields = {};
  for (const prop of tsType.getProperties()) {
    const propName = prop.name;
    const propTsType = checker.getTypeOfSymbolAtLocation(prop, node);
    shape[propName] = tsToTypeUnboxed(propTsType, node, compilerContext);
  }
  return shape;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function logType(tsType: ts.Type, { checker }: CompilerContext) {
  // console.log("QQQ: TYPE FLAGS: ", {
  //   flags: tsType.getFlags(),
  //   symbol: tsType.getSymbol()
  //     ? checker.symbolToString(tsType.getSymbol()!)
  //     : null,
  //   // toString, toFixed, ...
  //   properties: tsType
  //     .getProperties()
  //     .map((prop) => checker.symbolToString(prop)),
  //   // toString, toFixed, ...
  //   apparentProperties: tsType
  //     .getApparentProperties()
  //     .map((prop) => checker.symbolToString(prop)),
  //   // []
  //   callSignatures: tsType
  //     .getCallSignatures()
  //     .map((sig) => checker.signatureToString(sig)),
  //   // []
  //   constructSignatures: tsType
  //     .getConstructSignatures()
  //     .map((sig) => checker.signatureToString(sig)),
  //   // null
  //   stringIndexType: tsType.getStringIndexType()
  //     ? checker.typeToString(tsType.getStringIndexType()!)
  //     : null,
  //   // null
  //   numberIndexType: tsType.getNumberIndexType()
  //     ? checker.typeToString(tsType.getNumberIndexType()!)
  //     : null,
  //   // null
  //   baseTypes: tsType.getBaseTypes()
  //     ? tsType.getBaseTypes()!.map((t) => checker.typeToString(t))
  //     : null,
  //   // number
  //   nonNullableType: checker.typeToString(tsType.getNonNullableType()),
  //   // null
  //   constraint: tsType.getConstraint()
  //     ? checker.typeToString(tsType.getConstraint()!)
  //     : null,
  //   // null
  //   def: tsType.getDefault()
  //     ? checker.typeToString(tsType.getDefault()!)
  //     : null,
  //   // false
  //   isUnion: tsType.isUnion(),
  //   // false
  //   isIntersection: tsType.isIntersection(),
  //   // false
  //   isUnionOrIntersection: tsType.isUnionOrIntersection(),
  //   // false
  //   isLiteral: tsType.isLiteral(),
  //   // false
  //   isStringLiteral: tsType.isStringLiteral(),
  //   // false
  //   isNumberLiteral: tsType.isNumberLiteral(),
  //   // false
  //   isTypeParameter: tsType.isTypeParameter(),
  //   // false
  //   isClassOrInterface: tsType.isClassOrInterface(),
  //   // false
  //   isClass: tsType.isClass(),
  //   // false
  //   isIndexType: tsType.isIndexType(),
  // });
}
