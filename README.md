# GMACS syntax highlighting for VS Code

Syntax highlighting for `.gmacs` and `.acompute` files, the compute shader
languages of the Sara painting program.

!["screenshot.png"](https://raw.githubusercontent.com/MatejZeman02/gmacs-acompute-syntax-highlighting-vs-code-extension/refs/heads/main/screenshot.png)

## What it is for

A `.gmacs` file is GLSL compute written the way a Python user would write it.
Blocks are set by indentation, `def` declares a function, `#` opens a comment,
`/* */` and a triple quoted block are block comments,
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
- `#` comments, and `/* */` and triple quoted blocks in either quote as block
  comments wherever they stand, inside a `def`, `params` or `struct` too

Plain GLSL bodies fall through to the GDShader grammar from **Godot Tools**,
which colours types, swizzles, numbers and operators.

A kernel written as GLSL is coloured as well: `#kernel`, `#include`,
`[numthreads(...)]`, `layout(...)` and the preprocessor lines. This is the form
`.acompute` files use, and it was checked against real Sara kernels of that
shape.

## File types

The extension claims `.gmacs`, `.acompute`, `.glsl` and `.c`. The last two are
claimed on purpose, so shader code kept in those files gets the same colours. If
another extension should win for them, set `files.associations` in your VS Code
settings.

## Notebook cells

A Jupyter notebook cell whose first line is `%%gmacs` holds a Sara kernel, run
by the cell magic of Sara's Python client. VS Code gives each cell the language
of the notebook's kernel and resets any other language a Python kernel does not
know, so the extension injects a grammar into Python instead. In a cell that
starts with `%%gmacs`, the rest of the cell is coloured as gmacs, and the magic
line colours its layer names. A `%%gmacs` line anywhere below the first line
does nothing, as in IPython. Every other cell stays Python.

The kernels written for notebooks declare their sliders the way Godot shaders
do, `uniform float amount: hint_range(0, 1) = 1.0`, and `hint_range`,
`hint_enum` and `source_color` are coloured as hints.

## JupyterLab

The same colouring for `%%gmacs` cells in JupyterLab and Jupyter Notebook is a
JupyterLab extension of its own, kept in the `jupyterlab` folder of this
repository with its built wheel, `jupyterlab_gmacs_syntax-0.1.3-py3-none-any.whl`.
Install it with `pip install` on that wheel. How it is built and tested is in
the folder's `README.md`. The folder is left out of the `.vsix`.

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
| `/* */` blocks | `comment.block.gmacs` | green |
| `"""` and `'''` blocks | `comment.block.documentation.gmacs` | green |
| `hint_range`, `hint_enum`, `source_color` | `support.type.annotation.gmacs` | teal |
| `%%gmacs` at the top of a notebook cell | `keyword.control.magic.gmacs` | purple |

To see the scope of any token, run **Developer: Inspect Editor Tokens and
Scopes** from the command palette.

## Build the .vsix

Install [vsce](https://github.com/microsoft/vscode-vsce) once with
`npm install -g @vscode/vsce`, then run this in the repository root:

```bash
vsce package
```

This writes `gmacs-syntax-<version>.vsix` next to `package.json`.

## Test

`npm install` once, then `node test/tokenize.mjs`. It tokenises the cases in
`test/cases.json` with `vscode-textmate`, as a `%%gmacs` cell and as a file,
and checks every token against a plain reading of where each comment opens and
closes. Name notebooks after it and each of their `%%gmacs` cells must be gmacs
and each Python cell Python. `--dump` prints every token's scopes. It needs VS
Code's Python grammar and the GDShader grammar of Godot Tools, found where they
are installed or named by `GMACS_PYTHON_GRAMMAR` and `GMACS_GDSHADER_GRAMMAR`.

## Install

Download `gmacs-syntax-<version>.vsix` from the
[latest release](https://github.com/MatejZeman02/gmacs-acompute-syntax-highlighting-vs-code-extension/releases/latest), then run, with the
version you downloaded:

```bash
code --install-extension gmacs-syntax-1.2.1.vsix
```

Or open the Extensions view, choose the `...` menu and pick **Install from
VSIX**. Reload the window afterwards.

The extension depends on **Godot Tools**, and VS Code installs it alongside.

## The language in brief

A `.gmacs` kernel names itself, declares its storage, then defines functions:

```
kernel blur_x
import gaussian

image src: readonly
image dst

params:
    float sigma
    int radius

def blur_x():
    vec4 sum = vec4(0.0)
    float weight = 0.0
    for i in range(-radius, radius + 1):
        float w = gaussian(float(i), sigma)
        sum += w * image_load(src, pixel + ivec2(i, 0))
        weight += w
    image_store(dst, pixel, sum / weight)
```

- `kernel` names the entry point and `import` pulls in a shared file.
- `image`, `sampler` and `buffer` declare storage, and `params:` lists the
  values a dispatch passes in.
- Indentation sets the blocks, and the body is GLSL.
- Built-ins are snake_case, such as `image_load`. The GLSL spellings still work.
- `pixel` is the pixel the current run is for, and `and`, `or` and `not` stand
  for `&&`, `||` and `!`.

An `.acompute` file skips the dialect and writes the kernel as GLSL:

```glsl
#kernel fill
[numthreads(8, 8, 1)]
layout(rgba32f, set = 0, binding = 0) uniform image2D canvas;

[numthreads(8, 8, 1)] void fill() {
    imageStore(canvas, ivec2(gl_GlobalInvocationID.xy), vec4(1.0));
}
```

## What changed in 1.2.1

- A `/* */` block and a triple quoted block, in `"""` or `'''`, are coloured
  as comments in a file and in a `%%gmacs` cell, at the top level and inside
  every block, one line or many.
- **Toggle Line Comment** writes `#` and **Toggle Block Comment** writes
  `/* */`.

## What changed in 1.2.0

- A notebook cell that starts with `%%gmacs` is coloured as gmacs.
- `hint_range`, `hint_enum` and `source_color` are coloured as hints.

## What changed in 1.1.0

- The Python-shaped half of the dialect now has a grammar of its own.
- The `@` of a decorator takes the same colour as its name.
- `and`, `or` and `not` share the scope of `if`.

## Issues

Report problems on [GitHub](https://github.com/MatejZeman02/gmacs-acompute-syntax-highlighting-vs-code-extension/issues).
