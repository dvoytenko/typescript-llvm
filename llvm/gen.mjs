import llvm from 'llvm-bindings';

function main() {
    const context = new llvm.LLVMContext();
    const module = new llvm.Module('demo', context);
    const builder = new llvm.IRBuilder(context);

    // add()
    (() => {
        const returnType = builder.getInt32Ty();
        const paramTypes = [builder.getInt32Ty(), builder.getInt32Ty()];
        const functionType = llvm.FunctionType.get(returnType, paramTypes, false);
        const func = llvm.Function.Create(functionType, llvm.Function.LinkageTypes.ExternalLinkage, 'add', module);
    
        const entryBB = llvm.BasicBlock.Create(context, 'entry', func);
        builder.SetInsertPoint(entryBB);
        const a = func.getArg(0);
        const b = func.getArg(1);
        const result = builder.CreateAdd(a, b);
        builder.CreateRet(result);    

        if (llvm.verifyFunction(func)) {
            throw 'Verifying function failed';
        }
    })();

    // main()
    (() => {
        /*
        define i32 @main() local_unnamed_addr #0 {
        %1 = tail call i32 @puts(i8* nonnull dereferenceable(1) getelementptr inbounds ([12 x i8], [12 x i8]* @str, i64 0, i64 0))
        ret i32 11
        }
         */
        const returnType = builder.getInt32Ty();
        const paramTypes = [];
        const functionType = llvm.FunctionType.get(returnType, paramTypes, false);
        const func = llvm.Function.Create(functionType, llvm.Function.LinkageTypes.ExternalLinkage, 'main', module);
    
        const entryBB = llvm.BasicBlock.Create(context, 'entry', func);
        builder.SetInsertPoint(entryBB);

        builder.CreateRet(builder.getInt32(17));

        if (llvm.verifyFunction(func)) {
            throw 'Verifying function failed';
        }
    })();

    // puts()
    (() => {
        const returnType = builder.getInt32Ty();
        const paramTypes = [builder.getInt8PtrTy()];
        const functionType = llvm.FunctionType.get(returnType, paramTypes, false);
        const func = llvm.Function.Create(functionType, llvm.Function.LinkageTypes.ExternalLinkage, 'puts', module);
    
        if (llvm.verifyFunction(func)) {
            throw 'Verifying function failed';
        }
    })();

    if (llvm.verifyModule(module)) {
        console.error('Verifying module failed');
        return;
    }

    // console.log(module.getDataLayout().getStruct);

    console.log(module.print());
}

main();
