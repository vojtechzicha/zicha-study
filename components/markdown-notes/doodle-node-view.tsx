"use client"

import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react"
import { DoodleCanvas } from "@/components/markdown-notes/doodle-canvas"
import type { DoodleScene } from "@/lib/types/markdown-notes"

const DEFAULT_SCENE: DoodleScene = { version: 1, width: 640, height: 400, strokes: [] }

export function DoodleNodeView({ node, updateAttributes, editor, selected }: NodeViewProps) {
  const scene = (node.attrs.scene as DoodleScene) || DEFAULT_SCENE
  const editable = editor.isEditable

  return (
    <NodeViewWrapper
      className={`my-3 ${selected ? "outline outline-2 outline-primary-400 rounded-md" : ""}`}
      data-drag-handle
    >
      <DoodleCanvas
        scene={scene}
        editable={editable}
        onChange={(next) => updateAttributes({ scene: next })}
      />
    </NodeViewWrapper>
  )
}
