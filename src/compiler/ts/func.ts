import ts from "typescript";
import { CompilerContext } from "../context";
import { Instr } from "../instr";
import { Function } from "../instr/func";
import { Types } from "../types";
import { tsToGTypeUnboxed } from "./types";

export class TsFunction {
  public generated = false;

  constructor(
    public readonly node: ts.FunctionDeclaration,
    public readonly func: Function<any, any>
  ) {}

  get name() {
    return this.func.name;
  }
}

export function declFunction(
  node: ts.FunctionDeclaration,
  context: CompilerContext
): Function<any, any> {
  const { checker, types, instr } = context;
  const funcName = node.name!.text;

  if (funcName === "main") {
    return declMainFunction(node, types, instr);
  }

  const sig = checker.getSignatureFromDeclaration(node)!;
  const tsReturnType = checker.getReturnTypeOfSignature(sig);
  // console.log("QQQ: sig: ", checker.signatureToString(sig));
  // console.log("QQQ: ret: ", checker.typeToString(tsReturnType));
  const returnType = tsToGTypeUnboxed(tsReturnType, node, context);
  // console.log("QQQ: llReturnType: ", returnType);

  const args = node.parameters.map((arg) => {
    // const argName = arg.name.getText();
    const argType = checker.getTypeAtLocation(arg);
    const gArgType = tsToGTypeUnboxed(argType, arg, context);
    return gArgType;
  });

  const funcType = types.func(returnType, args);
  const func = instr.func(`u/${funcName}`, funcType);
  return func;
}

function declMainFunction(
  node: ts.FunctionDeclaration,
  types: Types,
  instr: Instr
) {
  const funcType = types.func(types.i32, []);
  const func = instr.func("main", funcType);
  return func;
}
