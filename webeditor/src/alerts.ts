// Plugin de ProseMirror para VIVO: pinta los blockquotes que empiezan con
// `[!NOTE|TIP|IMPORTANT|WARNING|CAUTION]` como callouts de color (clase gh-alert-*).
// El marcador `[!TYPE]` queda visible/editable (es un editor); el color va por CSS.
import { $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view';

const ALERT_RE = /^\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i;

export const alertPlugin = $prose(
  () =>
    new Plugin({
      key: new PluginKey('mdnotes-github-alerts'),
      props: {
        decorations(state) {
          const decos: Decoration[] = [];
          state.doc.descendants((node, pos) => {
            if (node.type.name !== 'blockquote') return;
            const first = node.firstChild?.textContent ?? '';
            const m = first.match(ALERT_RE);
            if (m) {
              decos.push(
                Decoration.node(pos, pos + node.nodeSize, {
                  class: `gh-alert gh-alert-${m[1].toLowerCase()}`,
                })
              );
            }
          });
          return DecorationSet.create(state.doc, decos);
        },
      },
    })
);
