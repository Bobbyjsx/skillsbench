# Contributing to Skillbench

Thank you for your interest in contributing to Skillbench!

## Development Environment Setup

Skillbench is a hybrid desktop application built with [Tauri](https://tauri.app/), featuring a Rust backend and a React (TypeScript) frontend.

### Prerequisites
1. **Node.js** (v18 or higher)
2. **Rust** (stable toolchain)
3. **OS dependencies** required by Tauri (see [Tauri Prerequisites](https://tauri.app/v1/guides/getting-started/prerequisites))

### Getting Started
1. Clone the repository:
   ```bash
   git clone https://github.com/bobbyjsx/skillbench.git
   cd skillbench
   ```

2. Install frontend dependencies:
   ```bash
   pnpm install
   ```

3. Run the application in development mode:
   ```bash
   pnpm run tauri dev
   ```
   This will start the Vite frontend server and compile the Rust backend, opening the Skillbench window.

## Code Standards
We use ESLint and Prettier to enforce consistent code style, and Husky to run checks before committing.

- Run `pnpm run lint` to check for linter errors.
- Run `pnpm run format` to auto-format code.

Ensure your code passes these checks before opening a pull request.

## Pull Request Process
1. Create a new branch for your feature or bugfix (`git checkout -b feature/my-feature`).
2. Make your changes and commit them. Husky will ensure they are formatted.
3. Push your branch and open a Pull Request against the `main` branch.
4. Provide a clear description of the problem solved or feature added.
