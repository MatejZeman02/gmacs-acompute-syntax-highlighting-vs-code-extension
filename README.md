# GMACS syntax highlighting for VS Code

Syntax highlighting for `.gmacs` files, the compute shader language of the
[Sara](https://github.com/MatejZeman02/sara-skeleton) painting program.

!["screenshot.png"](https://raw.githubusercontent.com/MatejZeman02/gmacs-acompute-syntax-highlighting-vs-code-extension/refs/heads/main/screenshot.png)

## What it is for

A `.gmacs` file is GLSL compute written the way a Python user would write it.
Blocks are set by indentation, `def` declares a function, `#` opens a comment,
and the storage is declared with short lines such as `image dst` and `params:`.
The body of a function is still plain GLSL.

This extension colours both halves. The Python-shaped half has its own grammar:

- `kernel`, `import`, `def` with its parameters and return type
- `params` and `struct` blocks, and `image`, `sampler` and `buffer` declarations
- `if`, `elif`, `else`, `while`, `for x in range(...)`, `match` and `case`
- the `@workgroup_size` and `@numthreads` decorators
- `and`, `or` and `not`
- the snake_case built-ins such as `image_load`, and the short names `pixel`,
  `global_id` and `local_id`
- `#` comments

Plain GLSL bodies fall through to the GDShader grammar from **Godot Tools**,
which colours types, swizzles, numbers and operators.

The old hash forms (`#include`, `#kernel`, `[numthreads]`) and the GLSL
preprocessor lines are still coloured, so a file written as GLSL looks right too.

## File types

The extension claims `.gmacs`, `.glsl` and `.c`. The last two are claimed on
purpose, so shader code kept in those files gets the same colours. If another
extension should win for them, set `files.associations` in your VS Code
settings.

## Colours

Scopes, and the colour each one gets in the default dark theme:

| Construct | Scope | Colour |
| --- | --- | --- |
| `if`, `elif`, `for`, `in`, `match`, `case`, `return`, `and`, `or`, `not` | `keyword.control.gmacs` | purple |
| `kernel`, `import` | `keyword.control.directive.kernel.gmacs`, `keyword.control.import.gmacs` | purple |
| `def`, `params`, `image`, `sampler`, `buffer`, `struct` | `storage.type.*.gmacs` | blue |
| `@workgroup_size`, `@numthreads`, the `@` included | `entity.name.function.decorator.gmacs` | yellow |
| the name after `def` or `kernel`, and built-in functions | `entity.name.function.gmacs`, `support.function.builtin.gmacs` | yellow |
| `pixel`, `global_id` and the other built-in variables | `variable.language.gmacs` | blue |
| `#` comments | `comment.line.number-sign.gmacs` | green |

To see the scope of any token, run **Developer: Inspect Editor Tokens and
Scopes** from the command palette.

## Build the .vsix

Install [vsce](https://github.com/microsoft/vscode-vsce) once with
`npm install -g @vscode/vsce`, then run this in the repository root:

```bash
vsce package
```

This writes `gmacs-syntax-<version>.vsix` next to `package.json`.

## Install

```bash
code --install-extension gmacs-syntax-1.1.0.vsix
```

Or open the Extensions view, choose the `...` menu and pick **Install from
VSIX**. Reload the window afterwards.

The extension depends on **Godot Tools**, and VS Code installs it alongside.

## The language

The dialect is documented in the Sara repository:

- [The kernel language](https://github.com/MatejZeman02/sara-skeleton/blob/main/docs/specs/scripting.md#the-kernel-language),
  the design as it was decided
- [GMACS.md](https://github.com/MatejZeman02/sara-skeleton/blob/main/docs/architecture/GMACS.md),
  the reference for what the compiler reads today

## What changed in 1.1.0

- The Python-shaped half of the dialect now has a grammar of its own.
- The `@` of a decorator takes the same colour as its name.
- `and`, `or` and `not` share the scope of `if`.
- `.acompute` files and the ACOMPUTE alias are no longer supported.

## Issues

Report problems on [GitHub](https://github.com/MatejZeman02/gmacs-acompute-syntax-highlighting-vs-code-extension/issues).
