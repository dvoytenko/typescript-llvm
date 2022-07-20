

### Assembly to bitcode:

```sh
llvm-as x.ll
ls -l x.bc
```

### To compile .ll files:

```sh
llc x.ll -filetype=obj
gcc x.o
./a.out
```
