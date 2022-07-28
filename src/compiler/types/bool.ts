import llvm from 'llvm-bindings';
import {Type, Value} from './base';

export class BoolType extends Type {
  constructor(context: llvm.LLVMContext) {
    super(
      context,
      llvm.IntegerType.get(context, 1)
    );
  }
}
