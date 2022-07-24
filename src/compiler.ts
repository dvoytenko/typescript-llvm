import ts, { FunctionDeclaration, ParameterDeclaration, PropertyAssignment } from "typescript";
import llvm, { PointerType } from 'llvm-bindings';

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
  OBJECT = 3,
}

type Shape = Array<{name: string; type: string}>;

interface IfcType {
  id: number;
  shape: Shape;
}

const propStartIndex = 1; // after vtable

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
  private structShapes: Map<llvm.Type, Shape> = new Map();
  private vtableType: llvm.StructType;
  private itableType: llvm.StructType;
  private structVtables: Map<string, llvm.Value> = new Map();
  private ifcTypes: Map<string, IfcType> = new Map();
  private baseObjType: llvm.StructType;
  private collectVtable: Map<string, Array<{id: number, itable: llvm.Constant}>> = new Map();
  private ifcIdCounter: number = 0;

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
    this.genComplete();

    console.log('');
    console.log('IR:');
    console.log(this.module.print());
    return this.module.print();
  }

  genComplete() {
    console.log('ITABLES: ', this.collectVtable);
    for (const [key, list] of this.collectVtable.entries()) {
      const vtable = this.structVtables.get(key)!;
      const itables = list.map(({itable}) => itable);

      // TODO: just reinitialize the itable_array const.
      const itableArrayType = llvm.ArrayType.get(
        llvm.PointerType.get(this.itableType, 0),
        itables.length
      );
      const itableArray = new llvm.GlobalVariable(
        this.module,
        /* type */ itableArrayType,
        /* isConstant */ true,
        /* linkage */ llvm.GlobalValue.LinkageTypes.PrivateLinkage,
        /* initializer */ llvm.ConstantArray.get(
          itableArrayType,
          itables
        ),
        `itable_array<${key}>_upd`
      );

      (vtable as llvm.GlobalVariable).setInitializer(
        llvm.ConstantStruct.get(
          this.vtableType,
          [
            // itable_length
            this.builder.getInt32(itables.length),
            // itable**
            this.builder.CreateBitCast(
              itableArray,
              llvm.PointerType.get(llvm.PointerType.get(this.itableType, 0), 0)
            ) as llvm.Constant,
          ]
        )
      );
    }
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
      // QQQ: remove itable?
      const itable = llvm.PointerType.get(this.builder.getInt32Ty(), 0);
      const null_itable = llvm.Constant.getNullValue(itable);
      const null_obj = llvm.Constant.getNullValue(this.builder.getInt8PtrTy());
      const boxType = llvm.StructType.create(
        this.context,
        [
          this.builder.getInt32Ty(),
          this.builder.getInt32Ty(),
          itable,
          this.builder.getInt8PtrTy(),
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
            null_itable,
            null_obj,
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
            null_itable,
            null_obj,
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
            null_itable,
            null_obj,
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
            null_itable,
            null_obj,
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
            null_itable,
            null_obj,
          ]
        ),
        'box_minus_one'
      );
    })();

    // object/vtable/itable
    (() => {
      // itable {i32 ifc_id, int32* offsets}
      const itableType = llvm.StructType.create(
        this.context,
        [
          // ifc_id
          this.builder.getInt32Ty(),
          // offsets
          llvm.PointerType.get(this.builder.getInt32Ty(), 0),
        ],
        "Itable"
      );
      this.itableType = itableType;
      this.libStructs.set("Itable", itableType);
      
      // vtable {i32 itable_len, itable* array}
      const vtableType = llvm.StructType.create(
        this.context,
        [
          // itable_length
          this.builder.getInt32Ty(),
          // itable**
          llvm.PointerType.get(llvm.PointerType.get(itableType, 0), 0),
        ],
        "Vtable"
      );
      this.vtableType = vtableType;
      this.libStructs.set("Vtable", vtableType);

      const baseObjType = llvm.StructType.create(
        this.context,
        [
          llvm.PointerType.get(this.vtableType, 0),
        ],
        'Obj'
      );
      this.baseObjType = baseObjType;
      this.libStructs.set("Obj", baseObjType);

      // Itable* get_itable_from_vtable(Vtable* vtable, i32 ifc_id)
      (() => {
        const functionType = llvm.FunctionType.get(
          // itable*
          llvm.PointerType.get(itableType, 0),
          [
            llvm.PointerType.get(vtableType, 0),
            this.builder.getInt32Ty(),
          ],
          false);
        const func = llvm.Function.Create(
          functionType,
          llvm.Function.LinkageTypes.ExternalLinkage,
          "get_itable_from_vtable",
          this.module
        );
        this.lib.set("get_itable_from_vtable", func);
        this.libTypes.set("get_itable_from_vtable", functionType);

        // Args.
        const vtable_ptr = func.getArg(0);
        const ifc_id = func.getArg(1);

        const entryBB = llvm.BasicBlock.Create(this.context, 'entry', func);
        this.builder.SetInsertPoint(entryBB);

        const retval = this.builder.CreateAlloca(
          llvm.PointerType.get(itableType, 0),
          null,
          "retval"
        );
        this.builder.CreateStore(
          llvm.Constant.getNullValue(llvm.PointerType.get(itableType, 0)),
          retval
        );

        const len = this.builder.CreateLoad(
          this.builder.getInt32Ty(),
          this.builder.CreateGEP(
            vtableType,
            vtable_ptr,
            [
              this.builder.getInt32(0),
              this.builder.getInt32(0),
            ]
          ),
          "len"
        );
        const itable_array_ptr = this.builder.CreateLoad(
          llvm.PointerType.get(llvm.PointerType.get(itableType, 0), 0),
          this.builder.CreateGEP(
            vtableType,
            vtable_ptr,
            [
              this.builder.getInt32(0),
              this.builder.getInt32(1),
            ]
          ),
          "itable_array_ptr"
        );

        const forStartBB = llvm.BasicBlock.Create(this.context, 'for.start', func);
        const forBodyBB = llvm.BasicBlock.Create(this.context, 'for.body', func);
        const forFoundBB = llvm.BasicBlock.Create(this.context, 'for.found', func);
        const forIncBB = llvm.BasicBlock.Create(this.context, 'for.inc', func);
        const forEndBB = llvm.BasicBlock.Create(this.context, 'for.end', func);

        this.builder.CreateBr(forStartBB);
        this.builder.SetInsertPoint(forStartBB);

        // %exitcond = icmp eq i32 %inc, 10
        const already_complete_cond = this.builder.CreateICmpEQ(
          len,
          this.builder.getInt32(0),
          "already_complete"
        );

        // br i1 %exitcond, label %for.end, label %for.body
        this.builder.CreateCondBr(
          already_complete_cond,
          forEndBB,
          forBodyBB
        );

        this.builder.SetInsertPoint(forBodyBB);

        // %i.02 = phi i32 [ 0, %for.start ], [ %inc, %for.body ]
        const index = this.builder.CreatePHI(
          this.builder.getInt32Ty(),
          2,
          "index"
        );
        // [ 0, %for.start ]
        index.addIncoming(
          this.builder.getInt32(0),
          forStartBB,
        );

        // load itable_ptr
        const itable_ptr = this.builder.CreateLoad(
          llvm.PointerType.get(itableType, 0),
          this.builder.CreateGEP(
            llvm.PointerType.get(itableType, 0),
            itable_array_ptr,
            [ index ]
          ),
          "itable_ptr"
        );

        // load ifc_id
        const itable_ifc_id = this.builder.CreateLoad(
          this.builder.getInt32Ty(),
          this.builder.CreateGEP(
            itableType,
            itable_ptr,
            [
              this.builder.getInt32(0),
              this.builder.getInt32(0),
            ]
          ),
          "itable_ifc_id"
        );

        // found
        const found = this.builder.CreateICmpEQ(
          ifc_id,
          itable_ifc_id,
          // this.builder.getInt32(111),
          // this.builder.getInt32(112),
          "found"
        );
        this.builder.CreateCondBr(
          found,
          forFoundBB,
          forIncBB,
        );

        this.builder.SetInsertPoint(forFoundBB);
        this.builder.CreateStore(itable_ptr, retval);
        this.builder.CreateBr(forEndBB);

        this.builder.SetInsertPoint(forIncBB);

        // %inc = add nuw nsw i32 %index, 1
        // TODO: nuw, nsw
        const inc = this.builder.CreateAdd(
          index,
          this.builder.getInt32(1),
          "inc"
        );
        // [ %inc, %for.body ]
        index.addIncoming(
          inc,
          forIncBB,
        );

        // %exitcond = icmp eq i32 %inc, 10
        const exitcond = this.builder.CreateICmpEQ(
          inc,
          len,
          "exitcond"
        );

        // br i1 %exitcond, label %for.end, label %for.body
        this.builder.CreateCondBr(
          exitcond,
          forEndBB,
          forBodyBB
        );

        this.builder.SetInsertPoint(forEndBB);

        const ret = this.builder.CreateLoad(
          llvm.PointerType.get(itableType, 0),
          retval,
          "ret"
        );
        this.builder.CreateRet(ret);
      })();
  
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

    // declare void @llvm.dbg.value(metadata, metadata, metadata) #1
    (() => {
      const functionType = llvm.FunctionType.get(
        llvm.Type.getVoidTy(this.context),
        [
          llvm.Type.getMetadataTy(this.context),
          llvm.Type.getMetadataTy(this.context),
          llvm.Type.getMetadataTy(this.context),
        ],
        false);
      const func = llvm.Function.Create(
        functionType,
        llvm.Function.LinkageTypes.ExternalLinkage,
        "llvm.dbg.value",
        this.module
      );
      this.lib.set("llvm.dbg.value", func);
      this.libTypes.set("llvm.dbg.value", functionType);
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

  declObjType(type: ts.Type, node: ts.Node): llvm.StructType {
    const key = `Obj<${this.checker.typeToString(type)}>`;
    let objType = this.libStructs.get(key);
    if (!objType) {
      const shape: Shape = [];
      for (const prop of type.getProperties()) {
        const propName = prop.name;
        const propType = this.checker.getTypeOfSymbolAtLocation(prop, node);
        const propTypeStr = this.checker.typeToString(propType);
        shape.push({ name: propName, type: propTypeStr });
      }
      objType = llvm.StructType.create(
        this.context,
        // TODO: types.
        [
          llvm.PointerType.get(this.vtableType, 0),
          ...shape.map(prop => this.builder.getInt32Ty()),
        ],
        key
      );
      this.collectVtable.set(key, []);

      // Auto ifc.
      const autoIfcKey = `Ifc<${this.checker.typeToString(type)}>`;
      const autoIfcType = this.declIfcType(type, node);
      const autoIfcId = autoIfcType.id;
      const autoIfcShape = autoIfcType.shape;
      const autoItable = this.computeItable(
        autoIfcId,
        key, shape, objType,
        autoIfcKey, autoIfcShape
      );

      const itables = [autoItable];

      const itableArrayType = llvm.ArrayType.get(
        llvm.PointerType.get(this.itableType, 0),
        itables.length
      );
      const itableArray = new llvm.GlobalVariable(
        this.module,
        /* type */ itableArrayType,
        /* isConstant */ true,
        /* linkage */ llvm.GlobalValue.LinkageTypes.PrivateLinkage,
        /* initializer */ llvm.ConstantArray.get(
          itableArrayType,
          itables
        ),
        `itable_array<${key}>`
      );
  
      const vtable = new llvm.GlobalVariable(
        this.module,
        /* type */ this.vtableType,
        /* isConstant */ true,
        /* linkage */ llvm.GlobalValue.LinkageTypes.PrivateLinkage,
        /* initializer */ llvm.ConstantStruct.get(
          this.vtableType,
          [
            // itable_length
            this.builder.getInt32(itables.length),
            // itable**
            this.builder.CreateBitCast(
              itableArray,
              llvm.PointerType.get(llvm.PointerType.get(this.itableType, 0), 0)
            ) as llvm.Constant,
          ]
        ),
        `vtable<${key}>`
      );

      this.libStructs.set(key, objType);
      this.structShapes.set(objType, shape);
      this.structVtables.set(key, vtable);
    }
    return objType;
  }

  computeItable(id: number, objName: string, obj: Shape, objType: llvm.StructType, ifcName: string, ifc: Shape): llvm.Constant {

    const name = `itable<${objName}, ${ifcName}>`;
    const arrayName = `itable_array<${objName}, ${ifcName}>`;

    const map = ifc.map(({name}) => obj.findIndex(({name: other}) => name === other));
    console.log('Map: ', name, map);

    const null_ptr = llvm.Constant.getNullValue(objType.getPointerTo());
    const itableOffsetsType = llvm.ArrayType.get(this.builder.getInt32Ty(), 2);

    const offsetArray = new llvm.GlobalVariable(
      this.module,
      /* type */ itableOffsetsType,
      /* isConstant */ true,
      /* linkage */ llvm.GlobalValue.LinkageTypes.PrivateLinkage,
      /* initializer */ llvm.ConstantArray.get(
        itableOffsetsType,
        map.map((index) =>
          this.builder.CreatePtrToInt(
            this.builder.CreateGEP(
              objType,
              null_ptr,
              [
                this.builder.getInt32(0),
                this.builder.getInt32(propStartIndex + index),
              ]
            ),
            this.builder.getInt32Ty()
          ) as llvm.Constant
        )
      ),
      arrayName
    );

    const itable = new llvm.GlobalVariable(
      this.module,
      /* type */ this.itableType,
      /* isConstant */ true,
      /* linkage */ llvm.GlobalValue.LinkageTypes.PrivateLinkage,
      /* initializer */ llvm.ConstantStruct.get(
        this.itableType,
        [
          // ifc_id
          this.builder.getInt32(id),
          // offsets
          this.builder.CreateBitCast(
            offsetArray,
            llvm.PointerType.get(this.builder.getInt32Ty(), 0)
          ) as llvm.Constant,
        ]
      ),
      name
    );

    const itables = this.collectVtable.get(objName)!;
    // const id = ++this.ifcIdCounter;
    itables.push({id, itable});

    return itable;
  }

  declIfcForObjType(objType: ts.Type, ifcType: ts.Type, node: ts.Node) {
    const llObjType = this.declObjType(objType, node);
    const objName = typeName(llObjType);
    const objShape = this.structShapes.get(llObjType)!;
    const ifcName = `Ifc<${this.checker.typeToString(ifcType)}>`;
    const llIfcType = this.declIfcType(ifcType, node);

    const ifcId = llIfcType.id;

    const itable = this.computeItable(
      ifcId,
      objName, objShape, llObjType,
      ifcName, llIfcType.shape
    );
  }

  declIfcType(type: ts.Type, node: ts.Node): IfcType {
    const key = `Ifc<${this.checker.typeToString(type)}>`;
    let ifcType = this.ifcTypes.get(key);
    if (!ifcType) {
      const id = ++this.ifcIdCounter;
      const shape: Shape = [];
      for (const prop of type.getProperties()) {
        const propName = prop.name;
        const propType = this.checker.getTypeOfSymbolAtLocation(prop, node);
        const propTypeStr = this.checker.typeToString(propType);
        shape.push({ name: propName, type: propTypeStr });
      }
      ifcType = {id, shape};
      this.ifcTypes.set(key, ifcType);
    }
    return ifcType;
  }

  private getType(type: llvm.Type): llvm.Type {
    return this.libStructs.get(typeName(type)) ?? type;
  }

  declFunction(node: ts.FunctionDeclaration): llvm.Function {
    const funcName = node.name!.text;
    if (!isConcrete(node)) {
      throw new Error(`not a concrete function: ${funcName}`);
    }

    const returnType = this.checker.getReturnTypeOfSignature(this.checker.getSignatureFromDeclaration(node)!);
    const returnTypeStr = this.checker.typeToString(returnType);

    const computeTypeShape = (p: ParameterDeclaration) => {
      const type = this.checker.getTypeAtLocation(p);
      const props = type.getProperties();
      if ((type.flags & ts.TypeFlags.Object) === 0) {
        return null;
      }
      const objType = this.declObjType(type, node);
      return {
        str: this.checker.typeToString(type),
        objType,
      };
    };

    const args = node.parameters.map(p => ({
      name: p.name.getText(),
      type: this.checker.typeToString(this.checker.getTypeAtLocation(p)),
      shape: computeTypeShape(p),
    }));

    this.exprCounter = 0;

    // TODO: map to actual types. everything below is wrong.
    // TODO: proper `|null` check.
    const llvmReturnType = returnTypeStr.endsWith('| null') ?
      this.boxType.getPointerTo() :
      this.builder.getInt32Ty();
    const llvmArgs = args.map(arg => {
      if (arg.shape) {
        // TODO: can we at least comment on the actual type?
        // return arg.shape.objType.getPointerTo();
        return this.baseObjType.getPointerTo();
      }
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
      const arg = func.getArg(i);
      const argType = llvmArgs[i];
      // Fixing `getType()`.
      // Object.defineProperty(arg, 'getType', {value: () => argType});
      this.refs.set(node.parameters[i], arg);
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
        isBoxPointer(func.getReturnType()) ?
          this.boxType.getPointerTo() :
          this.builder.getInt32Ty(),
        null,
        "retval"
      );

      // TODO: is this at all necessary or too paranoid?
      // if (isBoxPointer(func.getReturnType())) {
      //   this.builder.CreateStore(this.undefinedBox, this.retval);
      // }

      this.genStatement(func, node.body);

      const ret = this.builder.CreateLoad(
        isBoxPointer(func.getReturnType()) ?
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
            if (isBoxPointer(value.getType())) {
              fmt += "box<%d,%d>";
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

        this.printf(fmt, args);
        return null;
      }

      const funcRef = this.genExpr(expr);
      const args = node.arguments.map((arg, index) => {
        let value = this.genExpr(arg);
        if (isBoxPointer(funcRef.getArg(index).getType()) &&
          !isBoxPointer(value.getType())) {
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
        } else if (typeName(funcRef.getArg(index).getType()) === 'Obj*') {
          const sig = this.checker.getResolvedSignature(node)!;
          const argType = this.checker.getTypeAtLocation(arg);
          const sigArgType = this.checker.getTypeOfSymbolAtLocation(
            sig.parameters[index], node);
          this.declIfcForObjType(argType, sigArgType, node);
          value = this.builder.CreateBitCast(
            value,
            this.baseObjType.getPointerTo(),
            'cast_to_base_obj'
          );
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
      if (op.kind === ts.SyntaxKind.PlusToken ||
          op.kind === ts.SyntaxKind.AsteriskToken) {
        let vLeft = left, vRight = right;
        if (isBoxPointer(left.getType())) {
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
        if (isBoxPointer(right.getType())) {
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

        let res;
        switch (op.kind) {
          case ts.SyntaxKind.PlusToken:
            res = this.builder.CreateAdd(vLeft, vRight);
            break;
          case ts.SyntaxKind.AsteriskToken:
            res = this.builder.CreateMul(vLeft, vRight);
            break;
          default:
            throw new Error(`unknown binary operator: ${ts.SyntaxKind[op.kind]} (${op.getText()})`);
        }

        // TODO: when/who/why should box the values?
        if (isBoxPointer(left.getType()) ||
          isBoxPointer(right.getType())) {
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
    } else if (ts.isObjectLiteralExpression(node)) {
      // TODO: dedup object structure.

      // const symbol = this.checker.getSymbolAtLocation(node);
      // const type = this.checker.getTypeOfSymbolAtLocation(symbol!, node);
      const type = this.checker.getTypeAtLocation(node);

      const objType = this.declObjType(type, node);

      const objInst = llvm.ConstantStruct.get(
        objType,
        // TODO: more nuance to ordering, etc.
        [
          this.structVtables.get(objType.getName())!,
          ...node.properties.map(prop =>
            this.genExpr((prop as ts.PropertyAssignment).initializer))
        ],
      );

      const ptr = this.builder.CreateBitCast(
        this.builder.CreateCall(
          this.malloc,
          // TODO: sizeof()
          [this.builder.getInt64(100)]
        ),
        objType.getPointerTo()
      );
      this.builder.CreateStore(objInst, ptr);

      return ptr;
    } else if (ts.isPropertyAccessExpression(node)) {

      const target = this.genExpr(node.expression);

      const symbol = this.checker.getSymbolAtLocation(node.name);
      const decl = symbol!.valueDeclaration!;
      const declType = this.checker.getTypeAtLocation(decl.parent);

      const ifcType = this.declIfcType(declType, decl);
      const ifcId = ifcType.id;
      const ifcShape = ifcType.shape;

      // vtable/itable
      const vtable_ptr = this.builder.CreateLoad(
        llvm.PointerType.get(this.vtableType, 0),
        this.builder.CreateGEP(
          this.baseObjType,
          target,
          [
            this.builder.getInt32(0),
            // vtable index
            this.builder.getInt32(0),
          ]
        ),
        "vtable_ptr"
      );
      // this.printf("vtable: %016", [vtable_ptr]);

      const itable_ptr = this.builder.CreateCall(
        this.lib.get("get_itable_from_vtable")!,
        [
          vtable_ptr,
          this.builder.getInt32(ifcId),
        ],
        "itable_ptr"
      );
      // this.printf("itable: %016", [vtable_ptr]);

      const propName = node.name.text;
      const ifcPropIndex = ifcShape.findIndex(p => p.name === propName);

      const offsetArray = this.builder.CreateLoad(
        llvm.PointerType.get(this.builder.getInt32Ty(), 0),
        this.builder.CreateGEP(
          this.itableType,
          itable_ptr,
          [
            this.builder.getInt32(0),
            this.builder.getInt32(1),
          ]
        ),
        'offset_array'
      );

      const offset = this.builder.CreateLoad(
        this.builder.getInt32Ty(),
        this.builder.CreateGEP(
          this.builder.getInt32Ty(),
          offsetArray,
          [
            this.builder.getInt32(ifcPropIndex),
          ]
        ),
        'offset'
      );
      // this.printf("offset = %d", [offset]);

      const offset_on_obj = this.builder.CreateAdd(
        this.builder.CreatePtrToInt(
          target,
          this.builder.getInt64Ty()
        ),
        this.builder.CreateIntCast(offset, this.builder.getInt64Ty(), true),
        'offset_on_obj'
      );

      const offset_ptr = this.builder.CreateIntToPtr(
        offset_on_obj,
        // TODO: type
        llvm.PointerType.get(this.builder.getInt32Ty(), 0),
        'offset_ptr'
      );

      const value = this.builder.CreateLoad(
        // TODO: type
        this.builder.getInt32Ty(),
        offset_ptr
      );

      return value;
    } else {
      throw new Error(`unknown expression: ${ts.SyntaxKind[node.kind]}`);
    }
  }

  printf(fmt: string, args: llvm.Value[]) {
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

function typeName(type: llvm.Type) {
  switch (type.getTypeID()) {
    case llvm.Type.TypeID.PointerTyID:
      return typeName(type.getPointerElementType()) + "*";
    case llvm.Type.TypeID.FloatTyID:
      return "float";
    case llvm.Type.TypeID.DoubleTyID:
      return "double";
    case llvm.Type.TypeID.VoidTyID:
      return "void";
    case llvm.Type.TypeID.LabelTyID:
      return "label";
    case llvm.Type.TypeID.MetadataTyID:
      return "metadata";
    case llvm.Type.TypeID.TokenTyID:
      return "token";
    case llvm.Type.TypeID.IntegerTyID:
      if (type.isIntegerTy(1)) {
        return 'i1';
      }
      if (type.isIntegerTy(8)) {
        return 'i8';
      }
      if (type.isIntegerTy(16)) {
        return 'i16';
      }
      if (type.isIntegerTy(32)) {
        return 'i32';
      }
      if (type.isIntegerTy(64)) {
        return 'i64';
      }
      return "integer";
    case llvm.Type.TypeID.FunctionTyID:
      return "function";
    case llvm.Type.TypeID.ArrayTyID:
      // TODO: getElementType
      return "array";
    case llvm.Type.TypeID.FixedVectorTyID:
      return "vector";
    case llvm.Type.TypeID.ScalableVectorTyID:
      return "svector";
    case llvm.Type.TypeID.StructTyID:
      return (type as llvm.StructType).getName();
  }
  return `TY${type.getTypeID()}`;
}

function isBoxPointer(type: llvm.Type) {
  return typeName(type) === 'Box*';
}
