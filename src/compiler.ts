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

enum Type {
  UNDEFINED = 0,
  NULL = 1,
  NUMBER = 2,
}

export function compile(file: string) {
  console.log('COMPILE: ', file);
  const compiler = new Compiler([file]);
  return compiler.compile();
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
  private libStructs: Map<string, llvm.StructType> = new Map();
  private retval: llvm.Value | null = null;
  private undefinedBox: llvm.Constant;
  private nullBox: llvm.GlobalVariable;
  private zeroBox: llvm.GlobalVariable;
  private oneBox: llvm.GlobalVariable;
  private minusOneBox: llvm.GlobalVariable;
  private boxType: llvm.StructType;
  private malloc: llvm.Function;

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

  compile(): string {
    this.collectTopLevel();
    this.genTopLevel();
    // this.toLlvm();

    console.log('');
    console.log('IR:');
    console.log(this.module.print());
    return this.module.print();
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

    // native lib

    // declare i8* @malloc(i64)
    (() => {
      const functionType = llvm.FunctionType.get(
        this.builder.getInt8PtrTy(),
        [this.builder.getInt64Ty()],
        false);
      const func = llvm.Function.Create(
        functionType,
        llvm.Function.LinkageTypes.ExternalLinkage,
        "malloc",
        this.module
      );
      this.lib.set("malloc", func);
      this.libTypes.set("malloc", functionType);
      this.malloc = func;
    })();

    // box
    (() => {
      // this.builder.createrec
      // StructType *treeType = StructType::create(*context, StringRef("Tree"));
      const boxType = llvm.StructType.create(
        this.context,
        [
          this.builder.getInt32Ty(),
          this.builder.getInt32Ty(),
        ],
        "Box"
      );
      this.boxType = boxType;
      this.libStructs.set("Box", boxType);

      this.undefinedBox = new llvm.GlobalVariable(
        this.module,
        /* type */ boxType,
        /* isConstant */ true,
        /* linkage */ llvm.GlobalValue.LinkageTypes.PrivateLinkage,
        /* initializer */ llvm.ConstantStruct.get(
          boxType,
          [
            this.builder.getInt32(Type.UNDEFINED),
            this.builder.getInt32(0),
          ]
        ),
        'box_undefined'
      );
      this.nullBox = new llvm.GlobalVariable(
        this.module,
        /* type */ boxType,
        /* isConstant */ true,
        /* linkage */ llvm.GlobalValue.LinkageTypes.PrivateLinkage,
        /* initializer */ llvm.ConstantStruct.get(
          boxType,
          [
            this.builder.getInt32(Type.NULL),
            this.builder.getInt32(0),
          ]
        ),
        'box_null'
      );
      this.zeroBox = new llvm.GlobalVariable(
        this.module,
        /* type */ boxType,
        /* isConstant */ true,
        /* linkage */ llvm.GlobalValue.LinkageTypes.PrivateLinkage,
        /* initializer */ llvm.ConstantStruct.get(
          boxType,
          [
            this.builder.getInt32(Type.NUMBER),
            this.builder.getInt32(0),
          ]
        ),
        'box_zero'
      );
      this.oneBox = new llvm.GlobalVariable(
        this.module,
        /* type */ boxType,
        /* isConstant */ true,
        /* linkage */ llvm.GlobalValue.LinkageTypes.PrivateLinkage,
        /* initializer */ llvm.ConstantStruct.get(
          boxType,
          [
            this.builder.getInt32(Type.NUMBER),
            this.builder.getInt32(1),
          ]
        ),
        'box_one'
      );
      this.minusOneBox = new llvm.GlobalVariable(
        this.module,
        /* type */ boxType,
        /* isConstant */ true,
        /* linkage */ llvm.GlobalValue.LinkageTypes.PrivateLinkage,
        /* initializer */ llvm.ConstantStruct.get(
          boxType,
          [
            this.builder.getInt32(Type.NUMBER),
            this.builder.getInt32(-1),
          ]
        ),
        'box_minus_one'
      );
    })();

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
        [this.builder.getInt8PtrTy()],
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

  private isBoxPointer(type: llvm.Type) {
    return llvm.Type.isSameType(type, this.boxType.getPointerTo());
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
    // TODO: proper `|null` check.
    const llvmReturnType = returnTypeStr.endsWith('| null') ?
      this.boxType.getPointerTo() :
      this.builder.getInt32Ty();
    const llvmArgs = args.map(arg => {
      if (arg.type.endsWith('| null')) {
        return this.boxType.getPointerTo();
      }
      return this.builder.getInt32Ty();
    });

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
      // TODO: type
      this.retval = this.builder.CreateAlloca(
        this.isBoxPointer(func.getReturnType()) ?
          this.boxType.getPointerTo() :
          this.builder.getInt32Ty(),
        null,
        "retval"
      );

      // TODO: is this at all necessary or too paranoid?
      // if (this.isBoxPointer(func.getReturnType())) {
      //   this.builder.CreateStore(this.undefinedBox, this.retval);
      // }

      this.genStatement(func, node.body);

      const ret = this.builder.CreateLoad(
        this.isBoxPointer(func.getReturnType()) ?
          this.boxType.getPointerTo() :
          this.builder.getInt32Ty(),
        this.retval);
      this.builder.CreateRet(ret);
    }

    if (llvm.verifyFunction(func)) {
      // QQQ
      console.log(`Verifying function failed: ${funcName}`);
      //   throw new Error(`Verifying function failed: ${funcName}`);
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
        this.builder.CreateStore(value, this.retval!);
      } else {
        // TODO: CreateRetVoid
        this.builder.CreateStore(this.builder.getInt32(0), this.retval!);
      }
    } else if (ts.isExpressionStatement(node)) {
      this.genExpr(node.expression);
    } else if (ts.isIfStatement(node)) {

      const value = this.genExpr(node.expression);

      const trueBlock = llvm.BasicBlock.Create(this.context, undefined, func);
      const falseBlock = node.elseStatement ?
        llvm.BasicBlock.Create(this.context, undefined, func) :
        null;
      const contBlock = llvm.BasicBlock.Create(this.context, undefined, func);
      this.builder.CreateCondBr(
        value,
        trueBlock,
        falseBlock ?? contBlock
      );

      // then:
      this.builder.SetInsertPoint(trueBlock);
      this.genStatement(func, node.thenStatement);
      this.builder.CreateBr(contBlock);

      // else:
      if (falseBlock) {
        this.builder.SetInsertPoint(falseBlock);
        this.genStatement(func, node.elseStatement!);
        this.builder.CreateBr(contBlock);
      }

      // cont:
      this.builder.SetInsertPoint(contBlock);
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
            const value = this.genExpr(arg);
            if (this.isBoxPointer(value.getType())) {
              fmt += "box<%d,%d>";
              // public CreateLoad(type: Type, ptr: Value, name?: string): LoadInst;
              // public CreateGEP(type: Type, ptr: Value, idxList: Value[], name?: string): Value;
              // public CreateGEP(type: Type, ptr: Value, idx: Value, name?: string): Value;
              const t = this.builder.CreateLoad(
                this.builder.getInt32Ty(),
                this.builder.CreateGEP(
                  this.boxType,
                  value,
                  [
                    this.builder.getInt32(0),
                    this.builder.getInt32(0),
                  ]
                )
              );
              const v = this.builder.CreateLoad(
                this.builder.getInt32Ty(),
                this.builder.CreateGEP(
                  this.boxType,
                  value,
                  [
                    this.builder.getInt32(0),
                    this.builder.getInt32(1),
                  ]
                )
              );
              args.push(t, v);
            } else {
              fmt += '%d';
              args.push(value);
            }
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
          [strPtr]
        );
        return null;
      }

      const funcRef = this.genExpr(expr);
      const args = node.arguments.map((arg, index) => {
        let value = this.genExpr(arg);
        // console.log('ARG: ', arg, value,
        //   this.isBoxPointer(funcRef.getArg(index).getType()),
        //   this.isBoxPointer(value.getType()));
        if (this.isBoxPointer(funcRef.getArg(index).getType()) &&
          !this.isBoxPointer(value.getType())) {
          //QQQQ
          // %11 = call i8* @malloc(i64 %10)
          // callee: Function, args: Value[]
          const ptr = this.builder.CreateBitCast(
            this.builder.CreateCall(
              this.malloc,
              // TODO: sizeof()
              [this.builder.getInt64(100)]
            ),
            this.boxType.getPointerTo()
          );
          this.builder.CreateStore(
            llvm.ConstantStruct.get(
              this.boxType,
              [
                this.builder.getInt32(Type.NUMBER),
                value,
              ]
            ),
            ptr
          );
          value = ptr;
        }
        return value;
      });

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
    } else if (node.kind === ts.SyntaxKind.NullKeyword) {
      return this.nullBox;
    } else if (ts.isNumericLiteral(node)) {
      // TODO: type (llvm.ConstantFP.get(this.builder.getFloatTy(), 1.4))
      return this.builder.getInt32(parseInt(node.text, 10));
    } else if (ts.isBinaryExpression(node)) {
      const left = this.genExpr(node.left);
      const right = this.genExpr(node.right);
      const op = node.operatorToken;
      if (op.kind === ts.SyntaxKind.PlusToken) {
        let vLeft = left, vRight = right;
        if (this.isBoxPointer(left.getType())) {
          vLeft = this.builder.CreateLoad(
            this.builder.getInt32Ty(),
            this.builder.CreateGEP(
              this.boxType,
              left,
              [
                this.builder.getInt32(0),
                this.builder.getInt32(1),
              ]
            )
          );
        }
        if (this.isBoxPointer(right.getType())) {
          vRight = this.builder.CreateLoad(
            this.builder.getInt32Ty(),
            this.builder.CreateGEP(
              this.boxType,
              right,
              [
                this.builder.getInt32(0),
                this.builder.getInt32(1),
              ]
            )
          );
        }

        let res = this.builder.CreateAdd(vLeft, vRight);

        if (this.isBoxPointer(left.getType()) ||
            this.isBoxPointer(right.getType())) {
          const ptr = this.builder.CreateBitCast(
            this.builder.CreateCall(
              this.malloc,
              // TODO: sizeof()
              [this.builder.getInt64(100)]
            ),
            this.boxType.getPointerTo()
          );
          this.builder.CreateStore(
            this.builder.getInt32(Type.NUMBER),
            this.builder.CreateGEP(
              this.boxType,
              ptr,
              [
                this.builder.getInt32(0),
                this.builder.getInt32(0),
              ]
            )
          );
          this.builder.CreateStore(
            res,
            this.builder.CreateGEP(
              this.boxType,
              ptr,
              [
                this.builder.getInt32(0),
                this.builder.getInt32(1),
              ]
            )
          );
          res = ptr;
        }

        return res;
      } else if (op.kind === ts.SyntaxKind.EqualsEqualsEqualsToken) {
        // Special case: a === null.
        if (node.right.kind === ts.SyntaxKind.NullKeyword) {
          // TODO: left might not be a box?
          const t = this.builder.CreateLoad(
            this.builder.getInt32Ty(),
            this.builder.CreateGEP(
              this.boxType,
              left,
              [
                this.builder.getInt32(0),
                this.builder.getInt32(0),
              ]
            )
          );
          return this.builder.CreateICmpEQ(t, this.builder.getInt32(Type.NULL));
        }
        return this.builder.CreateICmpEQ(left, right);
      }
      throw new Error(`unknown binary operator: ${ts.SyntaxKind[op.kind]} (${op.getText()})`);
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
