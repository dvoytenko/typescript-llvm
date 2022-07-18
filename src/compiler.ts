import ts, { FunctionDeclaration } from "typescript";
import llvm from 'llvm-bindings';

const options: ts.CompilerOptions = {
  target: ts.ScriptTarget.Latest,
  module: ts.ModuleKind.ESNext,
  strictNullChecks: true,
  strictFunctionTypes: true,
  /*
    "esModuleInterop": true,
    "moduleResolution": "node",
    "sourceMap": true,
    "outDir": "out",
  */
};

export function compile(file: string) {
  console.log('COMPILE: ', file);
  const compiler = new Compiler([file]);
  compiler.compile();
  // compiler.debug();
}

class Compiler {
  private readonly program: ts.Program;
  private readonly checker: ts.TypeChecker;

  private sourceFile: ts.SourceFile;
  private functions: Map<string, FunctionDeclaration> = new Map();
  private toGenFunctions: Set<string> = new Set();
  private exprCounter: number = 0;
  private decls: Array<any> = [];
  private context: llvm.LLVMContext;
  private module: llvm.Module;
  private builder: llvm.IRBuilder;
  private refs: Map<ts.Node, llvm.Value> = new Map();
  private lib: Map<string, llvm.Function> = new Map();
  private libTypes: Map<string, llvm.FunctionType> = new Map();

  constructor(files: string[]) {
    this.program = ts.createProgram(files, options);
    this.checker = this.program.getTypeChecker();
  }

  debug() {
    for (const sourceFile of this.program.getSourceFiles()) {
      if (!sourceFile.isDeclarationFile) {
        printRecursiveFrom(this.checker, sourceFile, 0, sourceFile);
      }
    }
  }

  compile() {
    this.collectTopLevel();
    this.genTopLevel();
    // this.toLlvm();

    console.log('');
    console.log('IR:');
    console.log(this.module.print());
  }

  collectTopLevel() {
    for (const sourceFile of this.program.getSourceFiles()) {
      if (sourceFile.isDeclarationFile) {
        continue;
      }
      this.sourceFile = sourceFile;
      visitChildren(sourceFile, this.collectTopLevelNodeVisitor.bind(this));
    }
  }

  collectTopLevelNodeVisitor(node: ts.Node) {
    if (ts.isFunctionDeclaration(node) && node.name) {
      this.functions.set(node.name.getText(), node);
      if (isExported(node)) {
        this.toGenFunctions.add(node.name.getText());
      }
    }
  }

  genTopLevel() {
    this.context = new llvm.LLVMContext();
    this.module = new llvm.Module('demo', this.context);
    this.builder = new llvm.IRBuilder(this.context);

    // debug lib

    // declare i32 @snprintf(i8*, i32, i8*, ...)
    (() => {
      const functionType = llvm.FunctionType.get(
        this.builder.getInt32Ty(),
        [
          this.builder.getInt8PtrTy(),
          this.builder.getInt32Ty(),
          this.builder.getInt8PtrTy(),
        ],
        true);
      const func = llvm.Function.Create(
        functionType,
        llvm.Function.LinkageTypes.ExternalLinkage,
        "snprintf",
        this.module
      );
      this.lib.set("snprintf", func);
      this.libTypes.set("snprintf", functionType);
    })();

    // declare i32 @puts(i8*)
    (() => {
      const functionType = llvm.FunctionType.get(
        this.builder.getInt32Ty(),
        [ this.builder.getInt8PtrTy() ],
        false);
      const func = llvm.Function.Create(
        functionType,
        llvm.Function.LinkageTypes.ExternalLinkage,
        "puts",
        this.module
      );
      this.lib.set("puts", func);
      this.libTypes.set("puts", functionType);
    })();

    for (const name of this.toGenFunctions) {
      const func = this.functions.get(name)!;
      this.declFunction(func);
    }

    while (this.toGenFunctions.size > 0) {
      for (const name of this.toGenFunctions) {
        this.toGenFunctions.delete(name);
        const func = this.functions.get(name)!;
        this.genFunction(func);
      }
    }
  }

  private ref(node: ts.Node): llvm.Value {
    const value = this.refs.get(node);
    if (!value) {
      throw new Error(`ref not found for ${ts.SyntaxKind[node.kind]} ${(node as unknown as FunctionDeclaration).name?.text}`);
    }
    return value;
  }

  declFunction(node: ts.FunctionDeclaration): llvm.Function {
    const funcName = node.name!.text;
    if (!isConcrete(node)) {
      throw new Error(`not a concrete function: ${funcName}`);
    }

    const returnType = this.checker.getReturnTypeOfSignature(this.checker.getSignatureFromDeclaration(node)!);
    const returnTypeStr = this.checker.typeToString(returnType);

    const args = node.parameters.map(p => ({
      name: p.name.getText(),
      type: this.checker.typeToString(this.checker.getTypeAtLocation(p)),
    }));

    this.exprCounter = 0;

    // TODO: map to actual types
    const llvmReturnType = this.builder.getInt32Ty();
    const llvmArgs = args.map(arg => this.builder.getInt32Ty());

    const functionType = llvm.FunctionType.get(
      llvmReturnType, llvmArgs, false);
    const func = llvm.Function.Create(
      functionType,
      llvm.Function.LinkageTypes.ExternalLinkage,
      funcName,
      this.module
    );

    this.refs.set(node, func);
    for (let i = 0; i < args.length; i++) {
      this.refs.set(node.parameters[i], func.getArg(i));
    }

    return func;
  }

  genFunction(node: ts.FunctionDeclaration) {
    const funcName = node.name!.text;
    const func = this.module.getFunction(funcName);
    if (!func) {
      throw new Error(`Function not found: ${funcName}`);
    }

    if (node.body) {
      const entryBB = llvm.BasicBlock.Create(this.context, 'entry', func);
      this.builder.SetInsertPoint(entryBB);
      this.genStatement(func, node.body);
    }

    if (llvm.verifyFunction(func)) {
      throw new Error(`Verifying function failed: ${funcName}`);
    }
  }

  genStatement(func: llvm.Function, node: ts.Statement) {
    if (ts.isBlock(node)) {
      for (const st of node.statements) {
        this.genStatement(func, st);
      }
    } else if (ts.isReturnStatement(node)) {
      if (node.expression) {
        const value = this.genExpr(node.expression);
        this.builder.CreateRet(value);
      } else {
        this.builder.CreateRetVoid();
      }
    } else if (ts.isExpressionStatement(node)) {
      this.genExpr(node.expression);
    } else {
      throw new Error(`unknown statement: ${ts.SyntaxKind[node.kind]}`);
    }
  }

  genExpr(node: ts.Expression) {
    if (ts.isCallExpression(node)) {
      const expr = node.expression;

      // console.log pragma
      if (ts.isPropertyAccessExpression(expr) &&
          ts.isIdentifier(expr.expression) &&
          expr.expression.text === 'console' &&
          expr.name.text === 'log') {
        
        let fmt = '';
        const args: llvm.Value[] = [];
        for (const arg of node.arguments) {
          if (fmt.length > 0) {
            fmt += ' ';
          }
          if (ts.isStringLiteral(arg)) {
            fmt += arg.text;
          } else {
            // TODO: extract type from the signature and use
            // correct mask.
            fmt += '%d';
            args.push(this.genExpr(arg));
          }
        }

        const fmtPtr = this.builder.CreateGlobalStringPtr(fmt);
        const strPtr = this.builder.CreateAlloca(
          this.builder.getInt8Ty(),
          this.builder.getInt32(1000)
        );
        this.builder.CreateCall(
          this.libTypes.get("snprintf")!,
          this.lib.get("snprintf")!,
          [
            strPtr,
            this.builder.getInt32(1000),
            this.builder.CreateInBoundsGEP(
              this.builder.getInt8PtrTy(),
              fmtPtr,
              []
            ),
            ...args,
          ]
        );
        this.builder.CreateCall(
          this.libTypes.get("puts")!,
          this.lib.get("puts")!,
          [ strPtr ]
        );
        return null;
      }

      const funcRef = this.genExpr(expr);
      const args = node.arguments.map(arg => this.genExpr(arg));

      // sig: this.checker.signatureToString(
      //   this.checker.getResolvedSignature(node)!
      // ),
      // retType: this.checker.typeToString(
      //   this.checker.getReturnTypeOfSignature(
      //     this.checker.getResolvedSignature(node)!,
      //   )
      // ),

      return this.builder.CreateCall(funcRef, args);
    } else if (ts.isIdentifier(node)) {
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
        this.declFunction(decl);
        this.toGenFunctions.add(idName);
      }

      return this.ref(decl);
    } else if (ts.isNumericLiteral(node)) {
      // TODO: type
      return this.builder.getInt32(parseInt(node.text, 10));
    } else if (ts.isBinaryExpression(node)) {
      const left = this.genExpr(node.left);
      const right = this.genExpr(node.right);
      // QQQ: node.operatorToken.getText()
      return this.builder.CreateAdd(left, right);
    } else {
      throw new Error(`unknown expression: ${ts.SyntaxKind[node.kind]}`);
    }
  }
}

function printRecursiveFrom(
  checker: ts.TypeChecker,
  node: ts.Node, indentLevel: number, sourceFile: ts.SourceFile
) {
  const indentation = "-".repeat(indentLevel);
  const syntaxKind = ts.SyntaxKind[node.kind];
  const nodeText = node.getText(sourceFile);
  console.log(`${indentation}${syntaxKind}: ${nodeText}`);

  if (syntaxKind === 'Identifier') {
    const symbol = checker.getSymbolAtLocation(node);
    if (symbol) {
      console.log(`${indentation}-@@ symbol: ${symbol.getName()}`);
      console.log(`${indentation}-@@ symbol.doc: ${symbol.getDocumentationComment(checker)}`);
      console.log(`${indentation}-@@ symbol.type@decl: ${checker.typeToString(
        checker.getTypeOfSymbolAtLocation(symbol, symbol.valueDeclaration!)
      )}`);
      console.log(`${indentation}-@@ symbol.type@use: ${checker.typeToString(
        checker.getTypeOfSymbolAtLocation(symbol, node)
      )}`);
    }
  }

  node.forEachChild(child =>
    printRecursiveFrom(checker, child, indentLevel + 1, sourceFile)
  );
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

function isConcrete(func: ts.FunctionDeclaration): boolean {
  // TODO: generics, unions, etc.
  return true;
}
