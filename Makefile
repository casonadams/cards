.DEFAULT_GOAL := help

CARGO ?= cargo
CPUS ?= $(shell getconf _NPROCESSORS_ONLN 2>/dev/null || nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 4)
export CARGO_BUILD_JOBS ?= $(CPUS)
export RUST_TEST_THREADS ?= $(CPUS)

# LLVM clang for ring / wasm32 compilation on macOS
BREW_CLANG := $(shell test -x /opt/homebrew/opt/llvm/bin/clang && echo /opt/homebrew/opt/llvm/bin/clang)
BREW_AR := $(shell test -x /opt/homebrew/opt/llvm/bin/llvm-ar && echo /opt/homebrew/opt/llvm/bin/llvm-ar)
ifneq ($(BREW_CLANG),)
export CC_wasm32_unknown_unknown ?= $(BREW_CLANG)
endif
ifneq ($(BREW_AR),)
export AR_wasm32_unknown_unknown ?= $(BREW_AR)
endif

.PHONY: help
help: ## Display this help screen
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-16s\033[0m %s\n", $$1, $$2}'

.PHONY: all
all: fmt-check clippy test complexity crap ## Run all checks (format check, clippy, tests, complexity, CRAP)

.PHONY: build
build: ## Build all crates in debug mode
	$(CARGO) build --workspace

.PHONY: build-wasm
build-wasm: ## Build wasm32 target
	$(CARGO) build --package cards-wasm --target wasm32-unknown-unknown --release

.PHONY: check
check: ## Type check all targets
	$(CARGO) check --workspace --all-targets

.PHONY: test
test: ## Run unit and integration tests
	$(CARGO) test --workspace

.PHONY: fmt
fmt: ## Format all Rust source files
	$(CARGO) fmt --all

.PHONY: fmt-check
fmt-check: ## Check formatting of Rust source files
	$(CARGO) fmt --all -- --check

.PHONY: clippy
clippy: ## Run Clippy with warnings treated as errors
	$(CARGO) clippy --workspace --all-targets -- -D warnings

.PHONY: coverage
coverage: ## Generate LCOV test coverage trace
	@$(CARGO) llvm-cov --workspace --lcov --output-path target/lcov.info

.PHONY: crap
crap: coverage ## Evaluate CRAP metrics and gate on functions exceeding threshold 30
	@$(CARGO) crap --path . --lcov target/lcov.info --threshold 30 --format json 2>/dev/null | jq -e '([.entries[] | select(.crap > 30) | {file, line, function, crap: (.crap * 10 | round / 10), cc: .cyclomatic, cov: (.coverage * 10 | round / 10)}]) as $$v | if ($$v | length) > 0 then ($$v | halt_error(1)) else $$v end'

.PHONY: complexity
complexity: ## Evaluate Cognitive and Cyclomatic complexity with cccc and gate on cognitive <= 15
	@command -v cccc >/dev/null 2>&1 || { echo "Error: cccc not found. Install with: cargo install cccc-cli"; exit 1; }
	@cccc --max-cognitive 15 . | jq -e '([.files[]? | .path as $$path | .functions[]? | select(.cognitive > 15) | {file: $$path, line: .line, function: .name, cognitive: .cognitive, cyclomatic: .cyclomatic}]) as $$v | if ($$v | length) > 0 then ($$v | halt_error(1)) else $$v end'

.PHONY: clean
clean: ## Clean build artifacts
	$(CARGO) clean
