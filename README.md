# STS - Static Typescript

## To get started

1. [Install LLVM](TODO).
2. [Install WABT](https://github.com/WebAssembly/wabt).

## Known issues

1. I had to patch llvm-bindings in a few places. Not all of them have been released yet. E.g. see https://github.com/ApsarasX/llvm-bindings/issues/23.

## Some common commands

### Assembly to bitcode:

```sh
llvm-as x.ll
ls -l x.bc
```

### To compile .ll to machine code:

```sh
llc x.ll -filetype=obj
gcc x.o
./a.out
```

### To run optimizer:

```sh
opt -Oz -S -o x.Oz.ll x.ll
# --metarenamer - rename everything
```

### To WASM:

```sh
llc -mtriple=wasm32-unknown-unknown -O3 -filetype=obj one.ll -o one.o
wasm-ld one.o -o one.wasm -allow-undefined --entry "main"
```

To see WAT (see [wabt](https://github.com/WebAssembly/wabt)):

```sh
wasm2wat -o one.wat one.wasm
```
