import llvm from "llvm-bindings";
import ts from "typescript";
import { CompilerContext } from "./context";
import { Debug, debugFactory } from "./debug";
import { Instr, instrFactory } from "./instr";
import { Jslib, jslibFactory } from "./jslib";
import { expressions, ExprHandlers } from "./ts/expressions";
import { declFunction, TsFunction } from "./ts/func";
import { StatementHandlers, statements } from "./ts/statements";
import { tsToGTypeUnboxed } from "./ts/types";
import { types as typesFactory, type Types } from "./types";
import { Value } from "./types/base";
import { JsObject } from "./types/jsobject";
import { JsType, JsValueType } from "./types/jsvalue";
import { StructFields, StructType } from "./types/struct";

export function compile(file: string): string {
  console.log("COMPILE: ", file);

  const compiler = new Compiler([file]);
  const ir = compiler.compile();

  console.log("");
  console.log("IR:");
  console.log(ir);
  return ir;
}

class Compiler {
  private readonly program: ts.Program;
  private readonly checker: ts.TypeChecker;
  private readonly llContext: llvm.LLVMContext;
  private readonly llModule: llvm.Module;
  private readonly llBuilder: llvm.IRBuilder;
  private readonly types: Types;
  private readonly instr: Instr;
  private readonly debug: Debug;
  private readonly jslib: Jslib;
  private readonly compilerContext: CompilerContext;
  private readonly statements: StatementHandlers;
  private readonly expressions: ExprHandlers;

  private readonly functions: Map<ts.Node, TsFunction> = new Map();
  private readonly refs: Map<ts.Node, Value<any>> = new Map();
  private readonly objTypes: Map<string, JsObject> = new Map();
  private sourceFile: ts.SourceFile;
  private currentFunc: TsFunction | null = null;
  private blockTerminated: boolean[] = [];

  constructor(files: string[]) {
    this.program = ts.createProgram(files, {
      target: ts.ScriptTarget.Latest,
      module: ts.ModuleKind.ESNext,
      strictNullChecks: true,
      strictFunctionTypes: true,
      /*
        esModuleInterop: true,
        moduleResolution: "node",
        sourceMap: true,
        outDir: "out",
      */
    });
    this.checker = this.program.getTypeChecker();

    this.llContext = new llvm.LLVMContext();
    this.llModule = new llvm.Module("demo", this.llContext);
    this.llBuilder = new llvm.IRBuilder(this.llContext);
    this.types = typesFactory(this.llContext);
    this.instr = instrFactory(
      this.llContext,
      this.llBuilder,
      this.llModule,
      this.types
    );
    this.debug = debugFactory(
      this.llBuilder,
      this.llModule,
      this.instr,
      this.types
    );
    this.jslib = jslibFactory({
      instr: this.instr,
      types: this.types,
      debug: this.debug,
    });

    // CompilerContext
    const compiler = this;
    this.compilerContext = {
      types: this.types,
      instr: this.instr,
      debug: this.debug,
      jslib: this.jslib,
      checker: this.checker,
      currentFunc: () => compiler.currentFunc,
      ref: this.ref.bind(this),
      declFunction: this.declFunction.bind(this),
      genStatement: this.genStatement.bind(this),
      genExpr: this.genExpr.bind(this),
      genInBlock: (block, gen, finish) => {
        this.blockTerminated.push(false);
        this.instr.insertPoint(block);
        gen();
        const terminated = this.blockTerminated.pop();
        if (!terminated) {
          finish();
        }
      },
      terminateBlock: () => {
        if (this.blockTerminated.length > 0) {
          this.blockTerminated[this.blockTerminated.length - 1] = true;
        }
      },
      declObjType: this.declObjType.bind(this),
    };

    this.statements = statements(this.compilerContext);
    this.expressions = expressions(this.compilerContext);
  }

  compile(): string {
    this.collectTopLevel();
    this.gen();
    return this.llModule.print();
  }

  private ref(node: ts.Node): Value<any> {
    const value = this.refs.get(node);
    if (!value) {
      throw new Error(
        `ref not found for ${ts.SyntaxKind[node.kind]} ${
          (node as unknown as ts.FunctionDeclaration).name?.text
        }`
      );
    }
    return value;
  }

  private collectTopLevel() {
    for (const sourceFile of this.program.getSourceFiles()) {
      if (sourceFile.isDeclarationFile) {
        continue;
      }
      this.sourceFile = sourceFile;
      visitChildren(sourceFile, this.collectTopLevelNodeVisitor.bind(this));
    }
  }

  private collectTopLevelNodeVisitor(node: ts.Node) {
    if (ts.isFunctionDeclaration(node) && node.name) {
      if (isExported(node)) {
        this.declFunction(node);
      }
    }
  }

  private gen() {
    // Functions.
    while (this.functions.size > 0) {
      const toGen = Array.from(this.functions.values()).filter(
        (f) => !f.generated
      );
      if (toGen.length === 0) {
        break;
      }
      for (const func of toGen) {
        this.genFunction(func);
      }
    }
  }

  private declFunction(node: ts.FunctionDeclaration): TsFunction {
    if (this.functions.has(node)) {
      return this.functions.get(node)!;
    }

    console.log("QQQ: declFunction: ", node.name?.text);

    const func = declFunction(node, this.compilerContext);

    const funcObj = new TsFunction(node, func);
    this.functions.set(node, funcObj);

    for (let i = 0; i < node.parameters.length; i++) {
      const argNode = node.parameters[i];
      // const argName = argNode.name.getText();
      const argValue = func.args[i];
      this.refs.set(argNode, argValue);
    }

    return funcObj;
  }

  private genFunction(tsFunc: TsFunction) {
    tsFunc.generated = true;

    const { node, func } = tsFunc;
    const { instr } = this;

    if (!node.body) {
      return;
    }

    this.currentFunc = tsFunc;

    instr.insertPoint(instr.block(func, "entry"));

    this.genStatement(node.body);

    this.currentFunc = null;

    func.verify();
  }

  private genStatement(node: ts.Statement) {
    const handler = this.statements[node.kind];
    if (!handler) {
      throw new Error(`unknown statement: ${ts.SyntaxKind[node.kind]}`);
    }
    handler(node);
  }

  private genExpr(node: ts.Expression): Value<any> | TsFunction | null {
    const handler = this.expressions[node.kind];
    if (!handler) {
      throw new Error(`unknown expression: ${ts.SyntaxKind[node.kind]}`);
    }
    return handler(node);
  }

  private declObjType(tsType: ts.Type, node: ts.Node): JsObject {
    const tsTypeStr = this.checker.typeToString(tsType);
    const key = `u/Obj<${tsTypeStr}>`;
    let objType = this.objTypes.get(key);
    if (!objType) {
      const { types, instr, checker, llBuilder } = this;

      const shape: StructFields = {};
      for (const prop of tsType.getProperties()) {
        const propName = prop.name;
        const propType = checker.getTypeOfSymbolAtLocation(prop, node);
        const propGType = tsToGTypeUnboxed(
          propType,
          node,
          this.compilerContext
        );
        shape[propName] = propGType;
      }

      const shapeType = new StructType(
        types.context,
        `u/Shape<${tsTypeStr}>`,
        shape
      );

      // Create vtable.
      const { vtable, i8, i32, jsString } = types;
      const vtFieldsType = vtable.fields.fields;
      const vtFieldType = vtFieldsType.fields.fields.toType;
      const nullptr = shapeType.pointerOf().nullptr();

      const vtFields = Object.entries(shape).map(([fieldName, gType]) => {
        const field = instr.globalConstVar(
          "field",
          jsString.constValue(instr, fieldName)
        );
        const isJsv = gType.isPointer() && gType.toType instanceof JsValueType;
        // TODO: bool and other boxed types.
        const jsType = isJsv
          ? gType.toType.jsType
          : gType.isA(i32)
          ? JsType.NUMBER
          : JsType.UNKNOWN;
        const fieldPtr = shapeType.gep(llBuilder, nullptr, fieldName);
        const offset = llBuilder.CreatePtrToInt(
          fieldPtr.llValue,
          llBuilder.getInt32Ty()
        ) as llvm.Constant;

        return vtFieldType.createConst({
          field: jsString.pointer(field.llVar),
          jsType: i32.constValue(jsType),
          boxed: i8.constValue(isJsv ? 1 : 0),
          offset: new Value(i32, offset),
        });
      });
      const fieldsArrayType = llvm.ArrayType.get(
        vtFieldType.llType,
        vtFields.length
      );
      const fieldsArray = llvm.ConstantArray.get(
        fieldsArrayType,
        vtFields.map((f) => f.llValue as llvm.Constant)
      );
      const fieldsArrayVar = new llvm.GlobalVariable(
        this.llModule,
        /* type */ fieldsArrayType,
        /* isConstant */ true,
        /* linkage */ llvm.GlobalValue.LinkageTypes.PrivateLinkage,
        /* initializer */ fieldsArray,
        `u/VT<${tsTypeStr}>/fields`
      );
      const fieldsArrayVarPtr = llBuilder.CreateBitCast(
        fieldsArrayVar,
        vtFieldType.pointerOf().llType
      );

      const vtablePtr = instr.globalConstVar(
        `u/VT<${tsTypeStr}>`,
        vtable.createConst({
          fields: vtable.fields.fields.createConst({
            length: i32.constValue(Object.keys(shape).length),
            fields: vtFieldType.pointer(fieldsArrayVarPtr),
          }),
        })
      ).ptr;

      objType = types.jsCustObject(key, shapeType, vtablePtr);
      this.objTypes.set(key, objType);
    }
    return objType;
  }
}

function visitChildren(node: ts.Node, visitor: ts.Visitor) {
  node.forEachChild(visitor);
}

function isExported(node: ts.Node): boolean {
  if (!node.modifiers) {
    return false;
  }
  return node.modifiers.some((mod) => mod.kind === ts.SyntaxKind.ExportKeyword);
}
