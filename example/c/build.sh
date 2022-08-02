#!/bin/bash

clang -S -emit-llvm a.c
clang -S -emit-llvm b.c
llvm-link -S a.ll b.ll -o ab.ll
