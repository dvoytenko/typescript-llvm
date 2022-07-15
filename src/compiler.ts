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
  private exportedFunctions: Set<string> = new Set();
  private exprCounter: number = 0;
  private decls: Array<any> = [];

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
    this.toLlvm();
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
        this.exportedFunctions.add(node.name.getText());
      }
    }
  }

  genTopLevel() {
    for (const name of this.exportedFunctions) {
      const func = this.functions.get(name)!;
      this.genFunction(func);
    }
  }

  genFunction(node: ts.FunctionDeclaration) {
    const funcName = node.name!.getText();
    const syntaxKind = ts.SyntaxKind[node.kind];
    const nodeText = node.getText(this.sourceFile);
    console.log(`${syntaxKind}: ${nodeText}`,
      isExported(node));
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
    const statements = node.body ? this.genStatement(node.body) : null;

    const decl = {
      def: 'function',
      name: funcName,
      returnType: returnTypeStr,
      args,
      body: statements,
    };
    this.decls.push(decl);

    console.log(JSON.stringify(decl, undefined, 2));

    /*
    function add(a: number, b: number) {
      return a + b;
    }

    define i32 @add(i32 %0, i32 %1) {
    entry:
      %2 = add i32 %0, %1
      ret i32 %2
    }
     */
  }

  genStatement(node: ts.Statement): any[] {
    let res: any[] = [];

    if (ts.isBlock(node)) {
      for (const st of node.statements) {
        res = res.concat(this.genStatement(st));
      }
    } else if (ts.isReturnStatement(node)) {
      if (node.expression) {
        const [instr, value] = this.genExpr(node.expression);
        res = res.concat(instr);
        res = res.concat({def: 'ret', value});
      } else {
        res = res.concat({def: 'ret'});
      }
    } else if (ts.isExpressionStatement(node)) {
      const [instr, value] = this.genExpr(node.expression);
      res = res.concat(instr);
    } else {
      throw new Error(`unknown statement: ${ts.SyntaxKind[node.kind]}`);
    }

    return res;
  }

  genExpr(node: ts.Expression): [any[], any] {
    if (ts.isCallExpression(node)) {
      let [instr, value] = this.genExpr(node.expression);
      const args: any[] = [];
      for (const arg of node.arguments) {
        let [argInstr, argValue] = this.genExpr(arg);
        instr = instr.concat(argInstr);
        args.push(argValue);
      }
      instr = instr.concat({
        def: 'call',
        func: value,
        args,
        to: '%call.x',
        sig: this.checker.signatureToString(
          this.checker.getResolvedSignature(node)!
        ),
        retType: this.checker.typeToString(
          this.checker.getReturnTypeOfSignature(
            this.checker.getResolvedSignature(node)!,
          )
        ),
      });
      return [instr, '%call.x'];
    } else if (ts.isIdentifier(node)) {
      const idName = node.getText();
      let value = '';

      const func = this.functions.get(idName);
      if (func) {
        this.genFunction(func);
        value = '@' + idName;
      } else {
        value = '%' + idName;
      }

      // {def: 'load', what: node.getText(), to: funcName}
      return [[], value];
    } else if (ts.isNumericLiteral(node)) {
      // TODO: read const in some cases?
      return [[], {def: 'const', value: node.getText()}];
    } else if (ts.isBinaryExpression(node)) {
      const [leftInstr, leftValue] = this.genExpr(node.left);
      const [rightInstr, rightValue] = this.genExpr(node.right);
      return [
        [
          ...leftInstr,
          ...rightInstr,
          {
            def: 'bin',
            left: leftValue,
            right: rightValue,
            op: node.operatorToken.getText(),
            to: '%bin.x',
          },
        ], '%bin.x'];
    } else {
      throw new Error(`unknown expression: ${ts.SyntaxKind[node.kind]}`);
    }
  }

  toLlvm() {
    const context = new llvm.LLVMContext();
    const module = new llvm.Module('demo', context);
    const builder = new llvm.IRBuilder(context);

    for (const decl of this.decls) {
      this.toLlvmDecl(decl, null, builder, module, context);
    }

    console.log('');
    console.log('IR:');
    console.log(module.print());
  }

  toLlvmDecl(decl: any, parent: llvm.Function|null, builder: llvm.IRBuilder, module: llvm.Module, context: llvm.LLVMContext) {
    if (decl.def === 'function') {
      // TODO: def.returnType, def.args[].type
      const returnType = builder.getInt32Ty();
      const argTypes = decl.args.map(arg => builder.getInt32Ty());
      const functionType = llvm.FunctionType.get(returnType, argTypes, false);
      const func = llvm.Function.Create(
        functionType,
        llvm.Function.LinkageTypes.ExternalLinkage,
        decl.name,
        module
      );

      if (decl.body) {
        const entryBB = llvm.BasicBlock.Create(context, 'entry', func);
        builder.SetInsertPoint(entryBB);

        for (const instr of decl.body) {
          this.toLlvmDecl(instr, func, builder, module, context);
        }
      }
    } else if (decl.def === 'bin') {
      let result;
      if (decl.op === '+') {
        // QQQQ
        const left = parent!.getArg(0);
        const right = parent!.getArg(1);
        result = builder.CreateAdd(left, right, decl.to);
        console.log('RES: ', result);
      } else {
        throw new Error(`unknown op: ${decl.op}`);
      }
    } else if (decl.def === 'ret') {
      // QQQQ
      // builder.CreateRet(decl.value);
    } else if (decl.def === 'call') {
      // %call = call i32 @add(i32 1, i32 2)

      // QQQQ
      const func: llvm.Function = (() => {
        const returnType = builder.getInt32Ty();
        const argTypes = [builder.getInt32Ty(), builder.getInt32Ty()];
        const functionType = llvm.FunctionType.get(returnType, argTypes, false);
        return llvm.Function.Create(
          functionType,
          llvm.Function.LinkageTypes.ExternalLinkage,
          decl.func,
          module
        );        
      })();

      // QQQQ
      const args = [builder.getInt32(1), builder.getInt32(2)];

      const call = builder.CreateCall(func, args, decl.to);
      /*
        {
          "def": "call",
          "func": "%@add",
          "args": [
            {
              "def": "const",
              "value": "1"
            },
            {
              "def": "const",
              "value": "2"
            }
          ],
          "to": "%call.x",
          "sig": "(a: number, b: number): number",
          "retType": "number"
        },
       */
    } else {
      throw new Error(`unknown def: ${decl.def}`);
    }

    /* TODO
      if (llvm.verifyFunction(func)) {
          throw 'Verifying function failed';
      }
      */
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
