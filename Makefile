
SRC = ./src
OUT = ./out
INFRA_SRC = $(SRC)/infra
INFRA_OUT = $(OUT)/infra

all: prepare infra
	@echo "DONE"

prepare:
	mkdir -p $(OUT)
	mkdir -p $(INFRA_OUT)

infra: infra_compile infra_link infra_test

infra_compile:
	clang -S -emit-llvm $(INFRA_SRC)/arithm.c -o $(INFRA_OUT)/arithm.ll
	clang -S -emit-llvm $(INFRA_SRC)/debug.c -o $(INFRA_OUT)/debug.ll
	clang -S -emit-llvm $(INFRA_SRC)/jsnumber.c -o $(INFRA_OUT)/jsnumber.ll
	clang -S -emit-llvm $(INFRA_SRC)/jsobject.c -o $(INFRA_OUT)/jsobject.ll
	clang -S -emit-llvm $(INFRA_SRC)/jsstring.c -o $(INFRA_OUT)/jsstring.ll
	clang -S -emit-llvm $(INFRA_SRC)/stricteq.c -o $(INFRA_OUT)/stricteq.ll
	clang -S -emit-llvm $(INFRA_SRC)/test.c -o $(INFRA_OUT)/test.ll

infra_link:
	llvm-link -S \
		$(INFRA_OUT)/arithm.ll \
		$(INFRA_OUT)/debug.ll \
		$(INFRA_OUT)/jsnumber.ll \
		$(INFRA_OUT)/jsobject.ll \
		$(INFRA_OUT)/jsstring.ll \
		$(INFRA_OUT)/stricteq.ll \
		-o $(INFRA_OUT)/infra.ll

infra_test:
	llvm-link -S \
		$(INFRA_OUT)/infra.ll \
		$(INFRA_OUT)/test.ll \
		-o $(INFRA_OUT)/test-linked.ll
