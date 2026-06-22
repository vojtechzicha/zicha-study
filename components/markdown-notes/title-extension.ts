import { Node, mergeAttributes } from "@tiptap/core"

declare module "@tiptap/core" {
  // eslint-disable-next-line no-unused-vars
  interface Commands<ReturnType> {
    title: {
      // Toggle the current block between the document Title and a paragraph.
      setTitle: () => ReturnType
      toggleTitle: () => ReturnType
    }
  }
}

// A document "Title" block — the large heading above H1, typically the subject
// name (mirrors the Word "Title" style). Distinct from headings so it never
// collides with the H1–H4 hierarchy and renders with its own styling.
export const Title = Node.create({
  name: "title",
  group: "block",
  content: "inline*",
  defining: true,
  priority: 200,

  parseHTML() {
    return [{ tag: 'h1[data-type="title"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ["h1", mergeAttributes(HTMLAttributes, { "data-type": "title", class: "note-title" }), 0]
  },

  addCommands() {
    return {
      setTitle:
        () =>
        ({ commands }) =>
          commands.setNode(this.name),
      toggleTitle:
        () =>
        ({ commands }) =>
          commands.toggleNode(this.name, "paragraph"),
    }
  },
})
