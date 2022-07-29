import llvm from 'llvm-bindings';
import { Debug, debugFactory } from './debug';
import { Instr, instrFactory } from './instr';
import { Jslib, jslibFactory } from './jslib';
import { types as typesFactory, type Types } from './types';
import { Value } from './types/base';

export function compile(file: string): string {
  const context = new llvm.LLVMContext();
  const module = new llvm.Module('demo', context);
  const builder = new llvm.IRBuilder(context);

  const types = typesFactory(context);
  const instr = instrFactory(context, builder, module, types);
  const debug = debugFactory(builder, module, instr, types);
  const jslib = jslibFactory({instr, types, debug});

  doCompile({context, module, builder, types, instr, debug, jslib});

  console.log('');
  console.log('IR:');
  console.log(module.print());
  return module.print();
}

function doCompile({
  context,
  module,
  builder,
  types,
  instr,
  debug,
  jslib,
}: {
  context: llvm.LLVMContext;
  module: llvm.Module;
  builder: llvm.IRBuilder;
  types: Types;
  instr: Instr;
  debug: Debug;
  jslib: Jslib;
}) {
  const { i32, jsNumber, jsValue } = types;
  const jsNumberPtr = jsNumber.pointerOf();

  const addFunc = (() => {
    const funcType = types.func(
      jsNumberPtr,
      {
        a: jsNumberPtr,
        b: jsNumberPtr,
        c: jsNumberPtr,
      }
    );

    const func = instr.func("add3", funcType);
  
    instr.insertPoint(instr.block(func, 'entry'));

    const argA = func.arg("a");
    const argB = func.arg("b");
    const argC = func.arg("c");

    const ptrA = instr.cast('ptr_a', argA, jsValue);
    const ptrB = instr.cast('ptr_b', argB, jsValue);
    const ptrC = instr.cast('ptr_c', argC, jsValue);
  
    const ptrSum1 = jslib.add('sum1', ptrA, ptrB);
    const ptrSum2 = jslib.add('sum2', ptrSum1, ptrC);
    instr.ret(func, instr.cast('sum2_jsn', ptrSum2, jsNumber));
      
    return func;
  })();

  const mainFuncType = types.func(i32, {});
  const mainFunc = instr.func("main", mainFuncType);

  instr.insertPoint(instr.block(mainFunc, 'entry'));

  const varA = instr.globalConstVar("a", jsNumber.box(3));
  const varB = instr.globalConstVar("b", jsNumber.box(4));
  const varC = instr.globalConstVar("c", jsNumber.box(5));

  const res = instr.call('add_res', addFunc, {a: varA.ptr, b: varB.ptr, c: varC.ptr});

  debug.printf("hello world! %s", [debug.debugValue(res)]);
  instr.ret(mainFunc, i32.constValue(0));

  if (llvm.verifyFunction(mainFunc.llFunc)) {
    console.log('\x1b[31m main: FAILED \x1b[0m');
  } else {
    console.log('\x1b[34m main: SUCCESS \x1b[0m');
  }
}
