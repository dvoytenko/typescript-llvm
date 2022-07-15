import * as ts from "typescript";

const fileNames = ['./test/data/one.ts'];
const options: ts.CompilerOptions = {
  target: ts.ScriptTarget.Latest,
  module: ts.ModuleKind.ESNext,
  strictNullChecks: true,
  strictFunctionTypes: true,
  /*
    "module": "commonjs",
    "esModuleInterop": true,
    "moduleResolution": "node",
    "sourceMap": true,
    "outDir": "out",
  */
};

const program = ts.createProgram(fileNames, options);
const checker = program.getTypeChecker();

function printRecursiveFrom(
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
      printRecursiveFrom(child, indentLevel + 1, sourceFile)
  );
}

for (const sourceFile of program.getSourceFiles()) {
  if (!sourceFile.isDeclarationFile) {
    printRecursiveFrom(sourceFile, 0, sourceFile);
  }
}
