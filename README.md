# GMACS and ACOMPUTE syntax highlight extension

Syntax highlighting for `.gmacs` and `.acompute` shader files for Godot.

Depends on the **Godot Tools** extension's GDShader grammar. If it is not present, the extension falls back to `.glsl` or `.c` syntax.

## Features

- Highlights GMACS and ACOMPUTE shader files.
- Mainly adds: `#kernel` and `numthreads` with `#include` keywords syntax highlighting.
- Uses the GDShader grammar from **Godot Tools** when available.
- Falls back to GLSL or C syntax if GDShader is not installed.

## Installation

1. Install the extension from the Marketplace.
2. (Optional) Install **Godot Tools** to get GDShader-based highlighting.

## Usage

- Open any file with the `.gmacs` or `.acompute` extension.
- If the language mode is not selected automatically, set it to GMACS/ACOMPUTE via the language picker.

## Notes

- The extension is mainly for me and Acerola fans or just for those, who use compute shaders in godot.
- The fallback grammar is chosen to be readable even without GDShader, but it is less accurate than the Godot-specific grammar.
- there is no git repo for the issues. So you can contact me on `matej.zeman01@gmail.com`. 
