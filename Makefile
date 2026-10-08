.PHONY: all lint check complexity ripwire build clean help

# Default target runs all code quality and build gates
all: lint check complexity build
	@echo "✓ All checks and build passed successfully."

# Run fast AST linting across TypeScript/JS web code
lint:
	@echo "==> Running oxlint..."
	@cd web && pnpm lint

# Run Svelte & TypeScript type checks
check:
	@echo "==> Running svelte-check..."
	@cd web && pnpm check

# Enforce Cognitive and Cyclomatic complexity thresholds via cccc
complexity:
	@echo "==> Running cccc complexity checks..."
	@cccc web/src

# Run ripwire code intelligence and symbol ranking
ripwire:
	@echo "==> Running ripwire analysis..."
	@ripwire web/src --top-k=30

# Build production distribution for GitHub Pages
build:
	@echo "==> Building web production bundle..."
	@cd web && pnpm build

# Clean temporary build artifacts
clean:
	@echo "==> Cleaning dist and caches..."
	@rm -rf web/dist .cccc.cache

help:
	@echo "Available make targets:"
	@echo "  make all        - Run lint, check, complexity, and build"
	@echo "  make lint       - Run oxlint across web codebase"
	@echo "  make check      - Run svelte-check TypeScript type checking"
	@echo "  make complexity - Run cccc Cognitive/Cyclomatic complexity checks"
	@echo "  make ripwire    - Run ripwire code intelligence map"
	@echo "  make build      - Build static web bundle for GitHub Pages"
	@echo "  make clean      - Remove build artifacts and caches"
