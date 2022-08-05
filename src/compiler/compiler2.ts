import llvm from "llvm-bindings";
import ts from "typescript";
import { CompilerContext } from "./context";
import { Debug, debugFactory } from "./debug";
import { Instr, instrFactory } from "./instr";
import { Jslib, jslibFactory } from "./jslib";
import { expressions, ExprHandlers } from "./ts/expressions";
import { declFunction, TsFunction } from "./ts/func";
import { TsObj, TsIfc, completeVTable } from "./ts/obj";
import { StatementHandlers, statements } from "./ts/statements";
import { tsToStructFields } from "./ts/types";
import { types as typesFactory, type Types } from "./types";
import { Value } from "./types/base";
import { StructType } from "./types/struct";

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
  private readonly objTypes: Map<string, TsObj> = new Map();
  private readonly ifcs: Map<string, TsIfc> = new Map();
  private sourceFile: ts.SourceFile;
  private currentFunc: TsFunction | null = null;
  private blockTerminated: boolean[] = [];
  private ifcIdCounter = 0;

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
      module: this.llModule,
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
      declIfc: this.declIfc.bind(this),
    };

    this.statements = statements(this.compilerContext);
    this.expressions = expressions(this.compilerContext);
  }

  compile(): string {
    this.collectTopLevel();
    this.gen();
    this.complete();
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

  private declObjType(tsType: ts.Type, node: ts.Node): TsObj {
    const tsTypeStr = this.checker.typeToString(tsType);
    const key = `u/Obj<${tsTypeStr}>`;
    let obj = this.objTypes.get(key);
    if (!obj) {
      const { types, instr } = this;

      const shape = tsToStructFields(tsType, node, this.compilerContext);
      console.log("QQQQ: declObj: ", key, shape);
      const shapeType = new StructType(
        types.context,
        `u/Shape<${tsTypeStr}>`,
        shape
      );

      const autoIfc = this.declIfc(tsType, node);

      // Create vtable.
      const { vtable, vtableIfc, i32 } = types;
      const vtFieldsType = vtable.fields.fields;
      const vtFieldType = vtFieldsType.fields.fields.toType;

      const vtableVar = instr.globalConstVar(
        `u/VT<${tsTypeStr}>`,
        vtable.createConst({
          fields: vtable.fields.fields.createConst({
            length: i32.constValue(0),
            fields: vtFieldType.pointerOf().nullptr(),
          }),
          itable: vtable.fields.itable.createConst({
            autoId: i32.constValue(autoIfc.id),
            length: i32.constValue(0),
            ifcs: vtableIfc.pointerOf().nullptr(),
          }),
        })
      );

      const objType = types.jsCustObject(key, shapeType, vtableVar.ptr);
      obj = new TsObj(tsTypeStr, tsType, shape, objType, vtableVar, autoIfc);
      this.objTypes.set(key, obj);
    }
    return obj;
  }

  private declIfc(tsType: ts.Type, node: ts.Node): TsIfc {
    const tsTypeStr = this.checker.typeToString(tsType);
    const key = `u/Ifc<${tsTypeStr}>`;
    let ifc = this.ifcs.get(key);
    if (!ifc) {
      const id = ++this.ifcIdCounter;
      const shape = tsToStructFields(tsType, node, this.compilerContext);
      const shapeType = new StructType(
        this.types.context,
        `u/Shape<${tsTypeStr}>`,
        shape
      );
      ifc = new TsIfc(id, tsTypeStr, tsType, shape, shapeType);
      this.ifcs.set(key, ifc);
    }
    return ifc;
  }

  private complete() {
    // TODO: this is all wrong.
    for (const obj of this.objTypes.values()) {
      for (const ifc of this.ifcs.values()) {
        obj.ifcs.push(ifc);
      }
    }

    // Write vtables.
    for (const obj of this.objTypes.values()) {
      completeVTable(obj, this.compilerContext);
    }
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
