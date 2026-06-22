import { InputRule } from "@tiptap/core"
import { InlineMath, BlockMath } from "@tiptap/extension-mathematics"

// The bundled @tiptap/extension-mathematics uses a non-standard trigger
// ($$…$$ = inline, $$$…$$$ = block). We override the input rules to the
// conventional LaTeX syntax users expect: $…$ inline and $$…$$ block.

// Inline: `$x^2$` (opening not preceded by `$`, content without `$`/newline).
const InlineMathStandard = InlineMath.extend({
  addInputRules() {
    return [
      new InputRule({
        find: /(?<!\$)\$([^$\n]+?)\$$/,
        handler: ({ state, range, match }) => {
          const latex = match[1]
          state.tr.replaceWith(range.from, range.to, this.type.create({ latex }))
        },
      }),
    ]
  },
}).configure({ katexOptions: { throwOnError: false } })

// Block: a paragraph consisting solely of `$$ … $$` becomes a block formula.
const BlockMathStandard = BlockMath.extend({
  addInputRules() {
    return [
      new InputRule({
        find: /^\$\$([^$\n]+?)\$\$$/,
        handler: ({ state, range, match }) => {
          const latex = match[1]
          const { tr } = state
          const $from = state.doc.resolve(range.from)
          const node = this.type.create({ latex })
          const consumesHostTextblock =
            $from.depth > 0 &&
            $from.parent.isTextblock &&
            range.from === $from.start() &&
            range.to === $from.end()
          const canReplaceHostTextblock =
            consumesHostTextblock &&
            $from.node(-1).canReplaceWith($from.index(-1), $from.indexAfter(-1), this.type)
          const replacementRange = canReplaceHostTextblock
            ? { from: $from.before(), to: $from.after() }
            : range
          tr.replaceWith(replacementRange.from, replacementRange.to, node)
        },
      }),
    ]
  },
}).configure({ katexOptions: { throwOnError: false } })

// Block must be registered before inline so `$$…$$` matches block first.
export const mathExtensions = [BlockMathStandard, InlineMathStandard]
