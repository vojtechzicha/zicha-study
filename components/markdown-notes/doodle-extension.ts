import { Node, mergeAttributes } from "@tiptap/core"
import { ReactNodeViewRenderer } from "@tiptap/react"
import { DoodleNodeView } from "@/components/markdown-notes/doodle-node-view"
import type { DoodleScene } from "@/lib/types/markdown-notes"

const DEFAULT_SCENE: DoodleScene = { version: 1, width: 640, height: 400, strokes: [] }

declare module "@tiptap/core" {
  // eslint-disable-next-line no-unused-vars
  interface Commands<ReturnType> {
    doodle: {
      // Insert a new doodle, optionally with a background image to annotate.
      insertDoodle: (_options?: { background?: { src: string; mediaId?: string | null }; width?: number; height?: number }) => ReturnType
    }
  }
}

// A freehand drawing / image-annotation block. The scene (vector strokes +
// optional background image) is stored as editable JSON so it can be reopened.
export const Doodle = Node.create({
  name: "doodle",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      scene: {
        default: DEFAULT_SCENE,
        parseHTML: (element: HTMLElement) => {
          const raw = element.getAttribute("data-scene")
          if (!raw) return DEFAULT_SCENE
          try {
            return JSON.parse(raw)
          } catch {
            return DEFAULT_SCENE
          }
        },
        renderHTML: (attributes: { scene?: DoodleScene }) => ({
          "data-scene": JSON.stringify(attributes.scene ?? DEFAULT_SCENE),
        }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="doodle"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "doodle" })]
  },

  addNodeView() {
    return ReactNodeViewRenderer(DoodleNodeView)
  },

  addCommands() {
    return {
      insertDoodle:
        (options) =>
        ({ commands }) => {
          const scene: DoodleScene = {
            version: 1,
            width: options?.width ?? DEFAULT_SCENE.width,
            height: options?.height ?? DEFAULT_SCENE.height,
            strokes: [],
            background: options?.background ?? null,
          }
          return commands.insertContent({ type: this.name, attrs: { scene } })
        },
    }
  },
})
