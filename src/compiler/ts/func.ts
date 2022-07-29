import llvm from 'llvm-bindings';
import ts from "typescript";
import { Instr } from '../instr';
import { Function } from '../instr/func';
import { Types } from '../types';
import { tsToLlType, tsToLlTypeUnboxed } from './types';

export function declFunction(node: ts.FunctionDeclaration, checker: ts.TypeChecker, types: Types, instr: Instr): Function<any, any> {
  const funcName = node.name!.text;

  if (funcName === 'main') {
    return declMainFunction(node, types, instr);
  }

  const sig = checker.getSignatureFromDeclaration(node)!;
  const tsReturnType = checker.getReturnTypeOfSignature(sig);
  console.log('QQQQ: sig: ', checker.signatureToString(sig));
  console.log('QQQQ: ret: ', checker.typeToString(tsReturnType));
  const returnType = tsToLlType(tsReturnType, types, checker);
  console.log('QQQQ: llReturnType: ', returnType);

  const argList = node.parameters.map(arg => {
    const argName = arg.name.getText();
    const argType = checker.getTypeAtLocation(arg);
    console.log('QQQQ: arg: ', argName, checker.typeToString(argType));
    const llArgType = tsToLlType(argType, types, checker);
    console.log('QQQQ: llArgType: ', llArgType);
    return [argName, llArgType];
  });
  const args = Object.fromEntries(argList);

  const funcType = types.func(returnType, args);
  const func = instr.func(`u/${funcName}`, funcType);
  return func;
}

function declMainFunction(node: ts.FunctionDeclaration, types: Types, instr: Instr) {
  const funcType = types.func(types.i32, []);
  const func = instr.func('main', funcType);
  return func;
}
