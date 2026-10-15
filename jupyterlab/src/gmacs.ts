// A line-by-line gmacs tokenizer for CodeMirror 6.
//
// A port by hand of the VS Code grammar in editors/vscode/gmacs-syntax, because
// CodeMirror cannot read a TextMate grammar. The names it colours as built in
// come from src/names.ts, which generate_names.py writes.
import { StreamLanguage, StreamParser, StringStream } from '@codemirror/language';
import { BUILTIN_FUNCS, BUILTIN_VARS, STD_FUNCS } from './names';

const KEYWORDS = new Set(
  ('def kernel import struct params image sampler buffer for in if elif else ' +
    'while return break continue discard match case default and or not uniform ' +
    'const shared readonly writeonly coherent volatile restrict layout ' +
    'hint_range hint_enum source_color').split(' ')
);
const TYPE_RE =
  /^(void|bool|u?int|float|double|[biud]?vec[234]|d?mat[234](x[234])?|[iu]?(sampler|image)(1D|2D|3D|Cube|Buffer|2DArray))$/;

interface State {
  indent: number;
  colon: boolean;
  // The close of the block comment the line is inside, carried across lines:
  // '*/' after a /*, the same three quotes after a triple quoted block, or
  // null outside one.
  block: string | null;
}

// Reads a block comment up to its close, or to the end of the line when the
// close is on a later one.
function readBlock(stream: StringStream, state: State): string {
  const close = state.block as string;
  const body = close === '*/' ? /^[\s\S]*?\*\// : new RegExp('^[\\s\\S]*?' + close);
  if (stream.match(body)) {
    state.block = null;
  } else {
    stream.skipToEnd();
  }
  return 'comment';
}

export const gmacsParser: StreamParser<State> = {
  startState: () => ({ indent: 0, colon: false, block: null }),
  copyState: s => ({ ...s }),
  token(stream, state) {
    if (state.block !== null) {
      return readBlock(stream, state);
    }
    if (stream.sol()) {
      state.indent = stream.indentation();
      state.colon = false;
    }
    if (stream.eatSpace()) {
      return null;
    }
    const prevColon = state.colon;
    state.colon = stream.peek() === ':';
    // The magic line of a notebook cell.
    if (stream.sol() && stream.match(/^%%\w+.*/)) {
      return 'meta';
    }
    // A block comment, /* */ or a triple quoted block in either quote, is a
    // comment wherever it stands. The dialect strips the first and reads the
    // second as a docstring.
    const open = stream.match(/^(\/\*|"""|''')/) as RegExpMatchArray | null;
    if (open) {
      state.colon = prevColon;
      state.block = open[0] === '/*' ? '*/' : open[0];
      return readBlock(stream, state);
    }
    if (stream.eat('#')) {
      state.colon = prevColon;
      stream.skipToEnd();
      return 'comment';
    }
    if (stream.match(/^@\w+/)) {
      return 'meta';
    }
    if (stream.match(/^(0[xX][0-9a-fA-F]+|(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?)[uUfF]*/)) {
      return 'number';
    }
    if (stream.match(/^[A-Za-z_]\w*/)) {
      const word = stream.current();
      if (word === 'true' || word === 'false') {
        return 'atom';
      }
      if (KEYWORDS.has(word)) {
        return 'keyword';
      }
      if (TYPE_RE.test(word)) {
        return 'atom';
      }
      if (BUILTIN_VARS.has(word)) {
        return 'variable-2';
      }
      if (BUILTIN_FUNCS.has(word) || STD_FUNCS.has(word)) {
        return 'builtin';
      }
      return 'variable';
    }
    if (stream.match(/^[-+*\/%=<>!&|^~?:]+/)) {
      return 'operator';
    }
    stream.next();
    return null;
  },
  // A line ending in a colon opens a block, as in Python.
  indent: (state, _textAfter, cx) => state.indent + (state.colon ? cx.unit : 0),
  languageData: { commentTokens: { line: '#', block: { open: '/*', close: '*/' } } }
};

export const gmacsLanguage = StreamLanguage.define(gmacsParser);
