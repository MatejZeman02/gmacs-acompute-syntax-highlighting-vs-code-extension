// Tokenises gmacs with vscode-textmate as VS Code does and checks that a block
// comment, /* */ or a triple quoted block in either quote, is a comment
// wherever it stands and the code after it is code again.
//
//   npm install && node test/tokenize.mjs [notebook.ipynb ...]
//
// Every notebook named is read as well: each %%gmacs cell must be gmacs after
// its magic line and each Python cell must stay Python. With --dump the
// scopes of every token of the cases are printed.
//
// The Python and gdshader grammars are VS Code's and godot-tools', found where
// they are installed or named by GMACS_PYTHON_GRAMMAR and GMACS_GDSHADER_GRAMMAR.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const vsctm = require('vscode-textmate');
const oniguruma = require('vscode-oniguruma');

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(here);

function firstExisting(envName, candidates) {
    const named = process.env[envName];
    if (named) {
        return named;
    }
    for (const pattern of candidates) {
        const parts = pattern.split(path.sep);
        const star = parts.findIndex(p => p.includes('*'));
        if (star < 0) {
            if (fs.existsSync(pattern)) {
                return pattern;
            }
            continue;
        }
        const parent = parts.slice(0, star).join(path.sep);
        const prefix = parts[star].split('*')[0];
        if (!fs.existsSync(parent)) {
            continue;
        }
        const found = fs.readdirSync(parent).filter(d => d.startsWith(prefix)).sort().reverse();
        for (const d of found) {
            const full = path.join(parent, d, ...parts.slice(star + 1));
            if (fs.existsSync(full)) {
                return full;
            }
        }
    }
    throw new Error(`no grammar found, name one in ${envName}`);
}

const home = os.homedir();
const pythonGrammar = firstExisting('GMACS_PYTHON_GRAMMAR', [
    '/usr/share/code/resources/app/extensions/python/syntaxes/MagicPython.tmLanguage.json',
    '/usr/lib/code/extensions/python/syntaxes/MagicPython.tmLanguage.json',
    '/opt/visual-studio-code/resources/app/extensions/python/syntaxes/MagicPython.tmLanguage.json',
]);
const gdshaderGrammar = firstExisting('GMACS_GDSHADER_GRAMMAR', [
    path.join(home, '.vscode/extensions/geequlim.godot-tools-*/syntaxes/GDShader.tmLanguage.json'),
]);

const files = {
    'source.gmacs': path.join(root, 'syntaxes/gmacs.tmLanguage.json'),
    'source.python.gmacs-cell': path.join(root, 'syntaxes/gmacs-cell.injection.tmLanguage.json'),
    'source.python': pythonGrammar,
    'source.gdshader': gdshaderGrammar,
};

const wasm = fs.readFileSync(require.resolve('vscode-oniguruma/release/onig.wasm')).buffer;
await oniguruma.loadWASM(wasm);
const registry = new vsctm.Registry({
    onigLib: Promise.resolve({
        createOnigScanner: sources => new oniguruma.OnigScanner(sources),
        createOnigString: s => new oniguruma.OnigString(s),
    }),
    loadGrammar: async scopeName => {
        const file = files[scopeName];
        if (!file) {
            return null;
        }
        return vsctm.parseRawGrammar(fs.readFileSync(file, 'utf8'), file);
    },
    getInjections: scopeName => (scopeName === 'source.python' ? ['source.python.gmacs-cell'] : []),
});
const python = await registry.loadGrammar('source.python');
const gmacs = await registry.loadGrammar('source.gmacs');

// Every token of a document as {line, start, end, text, scopes}.
function tokenize(grammar, text) {
    const out = [];
    let stack = vsctm.INITIAL;
    text.split('\n').forEach((line, n) => {
        const r = grammar.tokenizeLine(line, stack);
        for (const t of r.tokens) {
            // The last token of a line ends one past it, on the newline the
            // tokenizer adds.
            const end = Math.min(t.endIndex, line.length);
            out.push({ line: n, start: t.startIndex, end, text: line.slice(t.startIndex, end), scopes: t.scopes });
        }
        stack = r.ruleStack;
    });
    return out;
}

// The comment ranges of a gmacs text by a plain reading of it: a /* */ block,
// a triple quoted block in either quote, and a # to the end of its line.
// The offsets are per line, as [line, from, to) spans.
function commentSpans(text, skipFirstLine) {
    const lines = text.split('\n');
    const spans = [];
    let line = skipFirstLine ? 1 : 0;
    let col = 0;
    let open = null;
    let openLine = 0;
    let openCol = 0;
    const closeOf = { '/*': '*/', '"""': '"""', "'''": "'''" };
    while (line < lines.length) {
        const s = lines[line];
        if (open) {
            const at = s.indexOf(closeOf[open], col);
            if (at < 0) {
                spans.push([line, col, s.length, open]);
                line += 1;
                col = 0;
                continue;
            }
            spans.push([line, col, at + closeOf[open].length, open]);
            col = at + closeOf[open].length;
            open = null;
            continue;
        }
        const rest = s.slice(col);
        const m = rest.match(/\/\*|"""|'''|#/);
        if (!m) {
            line += 1;
            col = 0;
            continue;
        }
        const at = col + m.index;
        if (m[0] === '#') {
            spans.push([line, at, s.length, '#']);
            line += 1;
            col = 0;
            continue;
        }
        open = m[0];
        openLine = line;
        openCol = at;
        spans.push([line, at, at + m[0].length, m[0]]);
        col = at + m[0].length;
    }
    if (open) {
        throw new Error(`unclosed block at ${openLine}:${openCol}`);
    }
    return spans;
}

// The kind of comment a token lies in, '/*', '"""', "'''" or '#', or null.
function spanOf(spans, line, start, end) {
    const s = spans.find(([l, a, b]) => l === line && start >= a && end <= b);
    return s ? s[3] : null;
}

let checks = 0;
const failures = [];
function check(ok, what) {
    checks += 1;
    if (!ok) {
        failures.push(what);
    }
}

const isComment = t => t.scopes.some(s => s.startsWith('comment.'));
const dump = process.argv.includes('--dump');

function checkGmacs(label, grammar, text, isCell) {
    const spans = commentSpans(text, isCell);
    const tokens = tokenize(grammar, text);
    if (dump) {
        console.log(`== ${label}`);
    }
    for (const t of tokens) {
        if (!t.text.trim()) {
            continue;
        }
        if (dump) {
            console.log(`${t.line}:${t.start} ${JSON.stringify(t.text)} ${t.scopes.join(' ')}`);
        }
        if (isCell && t.line === 0) {
            continue;
        }
        const kind = spanOf(spans, t.line, t.start, t.end);
        const want = kind !== null;
        const where = `${label}, line ${t.line} ${JSON.stringify(t.text)} [${t.scopes.join(' ')}]`;
        check(isComment(t) === want, want ? `not a comment: ${where}` : `a comment: ${where}`);
        if (isCell) {
            check(t.scopes.includes('source.gmacs'), `not gmacs: ${where}`);
        }
        if (kind === '/*') {
            check(t.scopes.includes('comment.block.gmacs'), `not comment.block.gmacs: ${where}`);
        } else if (kind === '"""' || kind === "'''") {
            check(t.scopes.includes('comment.block.documentation.gmacs'), `not comment.block.documentation.gmacs: ${where}`);
        }
    }
}

const cases = JSON.parse(fs.readFileSync(path.join(here, 'cases.json'), 'utf8'));
for (const c of cases) {
    checkGmacs(`cell, ${c.name}`, python, c.cell, true);
    const file = c.cell.split('\n').slice(1).join('\n');
    checkGmacs(`file, ${c.name}`, gmacs, file, false);
}

// A Python cell beside them stays Python, its docstring a Python string.
const pyCell = 'import sara\n"""A docstring, kernel float."""\n/* not gmacs */\nx = \'\'\'text\'\'\'\n';
for (const t of tokenize(python, pyCell)) {
    if (!t.text.trim()) {
        continue;
    }
    check(!t.scopes.some(s => s.includes('gmacs')), `python cell coloured as gmacs: ${JSON.stringify(t.text)} [${t.scopes.join(' ')}]`);
}

function checkNotebook(file) {
    const nb = JSON.parse(fs.readFileSync(file, 'utf8'));
    for (const [i, cell] of nb.cells.entries()) {
        if (cell.cell_type !== 'code') {
            continue;
        }
        const src = Array.isArray(cell.source) ? cell.source.join('') : cell.source;
        const label = `${path.basename(file)} cell ${i}`;
        const tokens = tokenize(python, src).filter(t => t.text.trim());
        if (src.startsWith('%%gmacs')) {
            check(tokens[0] && tokens[0].scopes.includes('punctuation.definition.magic.gmacs'), `${label}: magic line`);
            check(tokens.filter(t => t.line > 0).every(t => t.scopes.includes('source.gmacs')), `${label}: body not all gmacs`);
            check(tokens.some(t => t.scopes.some(s => s.startsWith('storage.type') || s.startsWith('keyword') || s.startsWith('support'))), `${label}: no gmacs keyword coloured`);
        } else if (!src.startsWith('%%')) {
            check(tokens.every(t => !t.scopes.some(s => s.includes('gmacs'))), `${label}: python cell coloured as gmacs`);
        }
    }
}
for (const arg of process.argv.slice(2)) {
    if (!arg.startsWith('--')) {
        checkNotebook(arg);
    }
}

for (const f of failures) {
    console.log(`FAIL ${f}`);
}
console.log(`${checks - failures.length} of ${checks} checks pass`);
process.exit(failures.length ? 1 : 0);
