import llvm from 'llvm-bindings';
import ts from "typescript";
import { CompilerContext } from './context';
import { Debug, debugFactory } from './debug';
import { Instr, instrFactory } from './instr';
import { Function } from './instr/func';
import { Jslib, jslibFactory } from './jslib';
import { declFunction } from './ts/func';
import { types as typesFactory, type Types } from './types';
import { Value } from './types/base';

export function compile(file: string): string {
  console.log('COMPILE: ', file);

  const compiler = new Compiler([file]);
  const ir = compiler.compile();

  console.log('');
  console.log('IR:');
  console.log(ir);
  return ir;
}

class Compiler implements CompilerContext {
  private readonly program: ts.Program;
  private readonly checker: ts.TypeChecker;
  private readonly llContext: llvm.LLVMContext;
  private readonly llModule: llvm.Module;
  private readonly llBuilder: llvm.IRBuilder;
  private readonly types: Types;
  private readonly instr: Instr;
  private readonly debug: Debug;
  private readonly jslib: Jslib;

  private readonly functions: Map<ts.Node, TsFunction> = new Map();
  private readonly refs: Map<ts.Node, Value<any>> = new Map();
  private sourceFile: ts.SourceFile;
  private currentFunc: TsFunction|null = null;

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
    this.llModule = new llvm.Module('demo', this.llContext);
    this.llBuilder = new llvm.IRBuilder(this.llContext);
    this.types = typesFactory(this.llContext);
    this.instr = instrFactory(this.llContext, this.llBuilder, this.llModule, this.types);
    this.debug = debugFactory(this.llBuilder, this.llModule, this.instr, this.types);
    this.jslib = jslibFactory({instr: this.instr, types: this.types, debug: this.debug});
  }

  compile(): string {
    this.collectTopLevel();
    this.gen();
    return this.llModule.print();
  }

  private ref(node: ts.Node): Value<any> {
    const value = this.refs.get(node);
    if (!value) {
      throw new Error(`ref not found for ${ts.SyntaxKind[node.kind]} ${(node as unknown as ts.FunctionDeclaration).name?.text}`);
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
    while (true) {
      const toGen = Array.from(this.functions.values()).filter(f => !f.generated);
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

    console.log('QQQ: declFunction: ', node.name?.text);

    const func = declFunction(node, this.checker, this.types, this.instr);

    const funcObj = new TsFunction(node, func);
    this.functions.set(node, funcObj);

    for (let i = 0; i < node.parameters.length; i++) {
      const argNode = node.parameters[i];
      const argName = argNode.name.getText();
      const argValue = func.args[i];
      this.refs.set(argNode, argValue);
    }

    return funcObj;
  }

  private genFunction(tsFunc: TsFunction) {
    tsFunc.generated = true;

    const {node, func} = tsFunc;
    const {instr, types, debug} = this;

    if (!node.body) {
      return;
    }

    this.currentFunc = tsFunc;

    instr.insertPoint(instr.block(func, 'entry'));

    this.genStatement(node.body);

    this.currentFunc = null;

    if (llvm.verifyFunction(func.llFunc)) {
      console.log(`${'\x1b[31m'}${tsFunc.name}: FAILED${'\x1b[0m'}`);
      //   throw new Error(`Verifying function failed: ${funcName}`);
    } else {
      console.log(`${'\x1b[34m'}${tsFunc.name}: SUCCESS${'\x1b[0m'}`);
    }
  }

  genStatement(node: ts.Statement) {
    // QQQ: refactor into separate modules.
    if (ts.isBlock(node)) {
      for (const st of node.statements) {
        this.genStatement(st);
      }
    } else if (ts.isReturnStatement(node)) {
      if (this.currentFunc!.name === 'main') {
        this.instr.ret(this.currentFunc!.func, this.types.i32.constValue(0));
      } else if (node.expression) {
        const value = this.genExpr(node.expression);
        if (!(value instanceof Value<any>)) {
          throw new Error('cannot return value');
        }
        this.instr.ret(this.currentFunc!.func, value);
      } else {
        // TODO: CreateRetVoid
        // this.builder.CreateStore(this.builder.getInt32(0), this.retval!);
      }
    } else if (ts.isExpressionStatement(node)) {
      this.genExpr(node.expression);
    } else {
      throw new Error(`unknown statement: ${ts.SyntaxKind[node.kind]}`);
    }
  }

  genExpr(node: ts.Expression): Value<any>|TsFunction|null {
    const {types, instr} = this;

    if (ts.isCallExpression(node)) {
      const expr = node.expression;

      // console.log pragma
      if (ts.isPropertyAccessExpression(expr) &&
        ts.isIdentifier(expr.expression) &&
        expr.expression.text === 'console' &&
        expr.name.text === 'log') {
        this.consoleLog(node);
        return null;
      }

      const funcRef = this.genExpr(expr);
      if (!funcRef) {
        throw new Error(`Function not found`);
      }

      if (funcRef instanceof TsFunction) {
        const {func} = funcRef;
        const args = func.type.args.map((type, index) => {
          const arg = node.arguments[index];
          const value = arg ? this.genExpr(arg) : null;
          if (!(value instanceof Value<any>)) {
            throw new Error('cannot use the arg');
          }
          // const typedValue = instr.cast();
          return value;
        });
        return instr.call(`${func.name}_res`, func, args);
      }

      throw new Error(`Function cannot be called yet`);
    }

    if (ts.isIdentifier(node)) {
      const idName = node.text;
      const symbol = this.checker.getSymbolAtLocation(node);
      if (!symbol) {
        throw new Error(`no symbol for identifier ${idName}`);
      }
      const decl = symbol.valueDeclaration;
      if (!decl) {
        throw new Error(`no declaration for identifier ${idName}`);
      }

      if (ts.isFunctionDeclaration(decl)) {
        return this.declFunction(decl);
      }

      return this.ref(decl);
    }

    if (ts.isNumericLiteral(node)) {
      // TODO: type (llvm.ConstantFP.get(this.builder.getFloatTy(), 1.4))
      const num = types.i32.constValue(parseInt(node.text, 10));
      // TODO: better name: take from VarDecl, or Param name, etc.
      const jsnumPtr = instr.malloc('num', types.jsNumber);
      return instr.storeBoxed(jsnumPtr, num);
    }

    if (ts.isBinaryExpression(node)) {
      const left = this.genExpr(node.left);
      const right = this.genExpr(node.right);
      if (!(left instanceof Value<any>)) {
        throw new Error('cannot use value for binary expression');
      }
      if (!(right instanceof Value<any>)) {
        throw new Error('cannot use value for binary expression');
      }
      const op = node.operatorToken;
      if (op.kind === ts.SyntaxKind.PlusToken) {
        // TODO: better name: var name, etc?
        return this.jslib.add('add_res', left, right);
      } else {
        throw new Error(`unknown binary operator: ${ts.SyntaxKind[op.kind]} (${op.getText()})`);
      }
    }

    throw new Error(`unknown expression: ${ts.SyntaxKind[node.kind]}`);
  }

  private consoleLog(node: ts.CallExpression) {
    const {debug} = this;
    let fmt = '';
    const args: Value<any>[] = [];
    for (const arg of node.arguments) {
      if (fmt.length > 0) {
        fmt += ' ';
      }
      if (ts.isStringLiteral(arg)) {
        fmt += arg.text;
      } else {
        // TODO: extract type from the signature and use
        // correct mask.
        const value = this.genExpr(arg);
        if (value == null) {
          fmt += 'null';
        } else if (value instanceof TsFunction) {
          fmt += `<function ${value.name}>`;
        } else {
          fmt += '%s';
          args.push(this.debug.debugValue(value));
        }
      }
    }

    debug.printf(fmt, args);
  }
}

function visitChildren(node: ts.Node, visitor: ts.Visitor) {
  node.forEachChild(visitor);
}

function isExported(node: ts.Node): boolean {
  if (!node.modifiers) {
    return false;
  }
  return node.modifiers.some(mod => mod.kind === ts.SyntaxKind.ExportKeyword);
}

class TsFunction {
  public generated: boolean = false;

  constructor(
    public readonly node: ts.FunctionDeclaration,
    public readonly func: Function<any, any>,
  ) {}

  get name() {
    return this.func.name;
  }
}
