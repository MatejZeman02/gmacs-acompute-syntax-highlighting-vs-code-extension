# gmacs syntax highlighting for JupyterLab

Colours a notebook cell as gmacs, the compute shader dialect of the Sara
painting program, while the cell's first line is `%%gmacs`. Every other cell
keeps the kernel's own language. It works in JupyterLab 4 and in Jupyter
Notebook 7, which is built on it.

## Installing

The extension is prebuilt, so installing it needs neither Node nor a rebuild of
JupyterLab. In the environment that runs JupyterLab:

```bash
pip install jupyterlab_gmacs_syntax-0.1.3-py3-none-any.whl
```

Restart JupyterLab and reload the page. `jupyter labextension list` shows
`jupyterlab-gmacs-syntax` as enabled. To remove it, `pip uninstall
jupyterlab-gmacs-syntax`.

## What it colours

- the magic line itself, `%%gmacs` and whatever follows it
- the keywords: `def`, `kernel`, `import`, `params`, `struct`, `image`,
  `sampler`, `buffer`, `uniform`, the hints `hint_range`, `hint_enum` and
  `source_color`, the control flow, and `and`, `or` and `not`
- the GLSL types, from `float` and `ivec2` to `sampler2D`, and `true` and
  `false`
- every built-in that gmacs renames, in both spellings, so `imageLoad` and
  `image_load` are coloured alike
- the GLSL functions gmacs keeps under their own name, such as `mix` and
  `smoothstep`
- the names the pixel function wrapper adds around a cell: `src`,
  `luminance` and `pixel`
- numbers, `@` decorators and `#` comments
- block comments, `/* */` and a triple quoted block in `"""` or `'''`, one
  line or many, wherever they stand

A line ending in a colon indents the next one, as in Python.

## How it works

JupyterLab gives a whole notebook one language, taken from its kernel, so a
cell magic cannot change it. The plugin registers gmacs as a language of its
own and watches each cell's text. While the first line is `%%gmacs`, it sets
the cell's own MIME type to `text/x-gmacs`, and the cell's editor reloads its
language. When the magic line goes, the cell gets its old type back.
jupyterlab-lsp switches the language of a cell the same way.

The tokenizer in `src/gmacs.ts` is a port by hand of the VS Code grammar at
the root of this repository, in `syntaxes/`, because CodeMirror, the editor
JupyterLab uses, cannot read a TextMate grammar.

## Building

You need Node 18 or newer and, in the Python environment, `jupyter-builder`
(`pip install jupyter-builder`). From this folder:

```bash
npm install
npm run build
pip wheel . --no-deps -w .
```

`src/names.ts` is committed, so a build needs nothing outside this folder.
It is written by `generate_names.py` from the dialect's own name table, which
Sara keeps at `sara-godot/core/custom-shader/gmacs_names.json` in Sara's
repository. When the dialect gains a name, run it with the table's path and
build again:

```bash
npm run names -- path/to/sara/sara-godot/core/custom-shader/gmacs_names.json
```

Raise the version in both `package.json` and `pyproject.toml` before
shipping a new wheel, and delete the old one.

## Testing

After `npm install`, `node test/tokenize.cjs` runs the parser over the cases in
`test/cases.json`, the same cases the VS Code extension's test reads, as a
`%%gmacs` cell and as a file, and checks that every token is a comment exactly
where a comment opens and closes. Name notebooks after it and their `%%gmacs`
cells are read the same way.

> [!NOTE]
> The built wheel is committed next to this README, like the `.vsix` of the
> VS Code extension, so whoever installs it never needs Node.

## Licence

MIT, see `LICENSE`.
