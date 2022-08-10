#!/bin/bash

clang -S -emit-llvm a.c
clang -S -emit-llvm b.c
llvm-link -S a.ll b.ll -o ab.ll

clang \
  --target=wasm32-unknown-wasi \
  --sysroot /tmp/wasi-libc \
  -nostartfiles \
  -Wl,--import-memory \
  -Wl,--no-entry \
  -Wl,--export-all \
  -o malloc_copy.wasm \
  malloc_copy.c
