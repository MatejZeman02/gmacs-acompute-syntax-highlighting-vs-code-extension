// Highlights a notebook cell as gmacs while its first line is `%%gmacs`.
//
// JupyterLab picks one language for the whole notebook, from the kernel, so a
// cell magic cannot switch it. This plugin registers gmacs as a language and
// sets the cell's own MIME type while the magic line is there, which makes the
// cell's editor reload its language. jupyterlab-lsp switches modes the same way.
import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import {
  IEditorExtensionRegistry,
  IEditorLanguageRegistry
} from '@jupyterlab/codemirror';
import { LanguageSupport } from '@codemirror/language';
import { gmacsLanguage } from './gmacs';

const MIME = 'text/x-gmacs';
const MAGIC = /^%%gmacs\b/;

const plugin: JupyterFrontEndPlugin<void> = {
  id: 'jupyterlab-gmacs-syntax:plugin',
  description: 'Highlights %%gmacs cells as gmacs.',
  autoStart: true,
  requires: [IEditorLanguageRegistry, IEditorExtensionRegistry],
  activate: (
    app: JupyterFrontEnd,
    languages: IEditorLanguageRegistry,
    extensions: IEditorExtensionRegistry
  ) => {
    languages.addLanguage({
      name: 'gmacs',
      mime: MIME,
      load: async () => new LanguageSupport(gmacsLanguage)
    });
    extensions.addExtension({
      name: 'gmacs:cell-magic',
      // Notebook cells report themselves inline, so the factory never asks.
      factory: ({ model }) => {
        let saved: string | null = null;
        const sync = () => {
          const first = model.sharedModel.getSource().split('\n', 1)[0];
          if (MAGIC.test(first)) {
            if (model.mimeType !== MIME) {
              saved = model.mimeType;
              model.mimeType = MIME;
            }
          } else if (saved !== null) {
            model.mimeType = saved;
            saved = null;
          }
        };
        model.sharedModel.changed.connect((_, change) => {
          if (change.sourceChange) {
            sync();
          }
        });
        // The notebook sets every code cell's MIME type again once the kernel
        // reports its language, which can come after this editor was built.
        // A cell that still starts with the magic takes gmacs back.
        model.mimeTypeChanged.connect(() => {
          if (model.mimeType !== MIME) {
            saved = null;
            sync();
          }
        });
        sync();
        return null;
      }
    });
  }
};

export default plugin;
