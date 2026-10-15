// Runs the gmacs stream parser of src/gmacs.ts over the cases in
// test/cases.json, the same cases the VS Code extension's test reads, and
// checks that a block comment, /* */ or a triple quoted block in either
// quote, is a comment wherever it stands and the code after it is code again.
//
//   npm install && node test/tokenize.cjs [notebook.ipynb ...]
//
// It compiles src/ to a scratch folder as CommonJS first. Every notebook
// named is read as well: each %%gmacs cell must open on its magic line and
// colour as comments exactly its comments. With --dump the style of every
// token is printed.
'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.dirname(__dirname);
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'gmacs-parser-'));
execFileSync(path.join(root, 'node_modules/.bin/tsc'), ['-p', root, '--module', 'commonjs', '--outDir', out, '--declaration', 'false'], { stdio: 'inherit' });
// The compiled file resolves @codemirror from this folder's node_modules.
fs.symlinkSync(path.join(root, 'node_modules'), path.join(out, 'node_modules'));
const { gmacsParser } = require(path.join(out, 'gmacs.js'));
const { StringStream } = require(path.join(root, 'node_modules/@codemirror/language'));

// Every token of a document as {line, start, end, text, style}, read as
// CodeMirror reads a stream language, line by line with the state carried.
function tokenize(text) {
    const tokens = [];
    const state = gmacsParser.startState(4);
    text.split('\n').forEach((line, n) => {
        if (!line.length) {
            if (gmacsParser.blankLine) {
                gmacsParser.blankLine(state, 4);
            }
            return;
        }
        const stream = new StringStream(line, 4, 4);
        while (!stream.eol()) {
            const style = gmacsParser.token(stream, state);
            if (stream.pos === stream.start) {
                throw new Error(`no progress at ${n}:${stream.pos}`);
            }
            tokens.push({ line: n, start: stream.start, end: stream.pos, text: line.slice(stream.start, stream.pos), style });
            stream.start = stream.pos;
        }
    });
    return tokens;
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
const dump = process.argv.includes('--dump');

function checkGmacs(label, text, isCell) {
    const spans = commentSpans(text, isCell);
    if (dump) {
        console.log(`== ${label}`);
    }
    for (const t of tokenize(text)) {
        if (!t.text.trim()) {
            continue;
        }
        if (dump) {
            console.log(`${t.line}:${t.start} ${JSON.stringify(t.text)} ${t.style}`);
        }
        const where = `${label}, line ${t.line} ${JSON.stringify(t.text)} [${t.style}]`;
        if (isCell && t.line === 0) {
            check(t.style === 'meta', `magic line not meta: ${where}`);
            continue;
        }
        // A stream token runs a comment's open and its body together, so it
        // is a comment when every character of it lies in a comment.
        const inside = [];
        for (let i = t.start; i < t.end; i++) {
            inside.push(spanOf(spans, t.line, i, i + 1) !== null);
        }
        const want = inside.every(Boolean);
        check(want || !inside.some(Boolean), `a token half in a comment: ${label}, line ${t.line} ${JSON.stringify(t.text)}`);
        check((t.style === 'comment') === want, want ? `not a comment: ${where}` : `a comment: ${where}`);
    }
}

const cases = JSON.parse(fs.readFileSync(path.join(__dirname, 'cases.json'), 'utf8'));
for (const c of cases) {
    checkGmacs(`cell, ${c.name}`, c.cell, true);
    checkGmacs(`file, ${c.name}`, c.cell.split('\n').slice(1).join('\n'), false);
}

for (const file of process.argv.slice(2).filter(a => !a.startsWith('--'))) {
    const nb = JSON.parse(fs.readFileSync(file, 'utf8'));
    for (const [i, cell] of nb.cells.entries()) {
        const src = Array.isArray(cell.source) ? cell.source.join('') : cell.source;
        if (cell.cell_type === 'code' && src.startsWith('%%gmacs')) {
            checkGmacs(`${path.basename(file)} cell ${i}`, src, true);
        }
    }
}

fs.rmSync(out, { recursive: true, force: true });
for (const f of failures) {
    console.log(`FAIL ${f}`);
}
console.log(`${checks - failures.length} of ${checks} checks pass`);
process.exit(failures.length ? 1 : 0);
