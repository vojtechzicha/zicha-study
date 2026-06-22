"use client"

import "katex/dist/katex.min.css"
import { useEditor, EditorContent } from "@tiptap/react"
import type { Content } from "@tiptap/core"
import { useEffect } from "react"
import { getNoteExtensions } from "@/components/markdown-notes/extensions"
import type { NoteContentJSON } from "@/lib/types/markdown-notes"

interface MarkdownNoteRendererProps {
  content: NoteContentJSON | null
  className?: string
}

// Read-only rendering of a Markdown note. Uses the exact same extension set as
// the editor so math, tables, images and doodles render identically.
export function MarkdownNoteRenderer({ content, className }: MarkdownNoteRendererProps) {
  const editor = useEditor({
    editable: false,
    immediatelyRender: false,
    extensions: getNoteExtensions(),
    content: (content ?? { type: "doc", content: [{ type: "paragraph" }] }) as Content,
    editorProps: {
      attributes: { class: "tiptap-note prose prose-slate max-w-none focus:outline-none" },
    },
  })

  // Keep rendered output in sync if the content prop changes (e.g. version preview).
  useEffect(() => {
    if (editor && content) {
      editor.commands.setContent(content as Content)
    }
  }, [editor, content])

  if (!editor) return null

  return <EditorContent editor={editor} className={className} />
}
