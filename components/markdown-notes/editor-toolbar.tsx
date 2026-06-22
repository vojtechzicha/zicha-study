"use client"

import { useRef, useState } from "react"
import type { Editor } from "@tiptap/react"
import { Button } from "@/components/ui/button"
import { Toggle } from "@/components/ui/toggle"
import { Separator } from "@/components/ui/separator"
import {
  Bold, Italic, Strikethrough, Code, Heading1, Heading2, Heading3, Heading4,
  Type, List, ListOrdered, ListChecks, Quote, Minus, Link2, Table as TableIcon,
  Image as ImageIcon, Pencil, Sigma, Undo2, Redo2, Loader2, ClipboardPaste,
} from "lucide-react"
import { uploadMarkdownImage } from "@/lib/actions/markdown-notes"
import { markdownToEditorHtml } from "@/components/markdown-notes/markdown-import"

interface EditorToolbarProps {
  editor: Editor
  noteId: string
}

export function EditorToolbar({ editor, noteId }: EditorToolbarProps) {
  const imageInput = useRef<HTMLInputElement>(null)
  const annotateInput = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const upload = async (file: File): Promise<{ url: string } | null> => {
    setUploading(true)
    try {
      const buf = await file.arrayBuffer()
      const res = await uploadMarkdownImage(noteId, buf, file.type || "image/png", file.name)
      if (res.error || !res.url) return null
      return { url: res.url }
    } finally {
      setUploading(false)
    }
  }

  const handleImageFile = async (file: File) => {
    const res = await upload(file)
    if (res) editor.chain().focus().setImage({ src: res.url }).run()
  }

  const handleAnnotateFile = async (file: File) => {
    const res = await upload(file)
    if (!res) return
    // Load natural dimensions so the doodle canvas matches the image aspect.
    const img = new window.Image()
    img.onload = () => {
      const maxW = 800
      const scale = img.width > maxW ? maxW / img.width : 1
      editor
        .chain()
        .focus()
        .insertDoodle({
          background: { src: res.url },
          width: Math.round(img.width * scale),
          height: Math.round(img.height * scale),
        })
        .run()
    }
    img.onerror = () => {
      editor.chain().focus().insertDoodle({ background: { src: res.url } }).run()
    }
    img.src = res.url
  }

  const addLink = () => {
    const prev = editor.getAttributes("link").href as string | undefined
    const url = window.prompt("Odkaz (URL):", prev || "https://")
    if (url === null) return
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run()
  }

  const pasteMarkdown = async () => {
    let md = ""
    try {
      md = await navigator.clipboard.readText()
    } catch {
      md = window.prompt("Vložte Markdown text:") || ""
    }
    if (!md.trim()) return
    editor.chain().focus().insertContent(markdownToEditorHtml(md)).run()
  }

  const addInlineMath = () => {
    const latex = window.prompt("Inline LaTeX:", "x^2")
    if (latex) editor.chain().focus().insertInlineMath({ latex }).run()
  }

  const addBlockMath = () => {
    const latex = window.prompt("Blokový LaTeX:", "\\int_0^1 x^2\\,dx")
    if (latex) editor.chain().focus().insertBlockMath({ latex }).run()
  }

  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-1 border-b bg-white/95 p-2 backdrop-blur">
      <Toggle size="sm" pressed={editor.isActive("bold")} onPressedChange={() => editor.chain().focus().toggleBold().run()} aria-label="Tučné">
        <Bold className="h-4 w-4" />
      </Toggle>
      <Toggle size="sm" pressed={editor.isActive("italic")} onPressedChange={() => editor.chain().focus().toggleItalic().run()} aria-label="Kurzíva">
        <Italic className="h-4 w-4" />
      </Toggle>
      <Toggle size="sm" pressed={editor.isActive("strike")} onPressedChange={() => editor.chain().focus().toggleStrike().run()} aria-label="Přeškrtnuté">
        <Strikethrough className="h-4 w-4" />
      </Toggle>
      <Toggle size="sm" pressed={editor.isActive("code")} onPressedChange={() => editor.chain().focus().toggleCode().run()} aria-label="Kód">
        <Code className="h-4 w-4" />
      </Toggle>

      <Separator orientation="vertical" className="mx-1 h-6" />

      <Toggle
        size="sm"
        pressed={editor.isActive("title")}
        onPressedChange={() => editor.chain().focus().toggleTitle().run()}
        aria-label="Titulek"
      >
        <Type className="h-4 w-4" />
      </Toggle>

      {[1, 2, 3, 4].map((lvl) => {
        const Icon = lvl === 1 ? Heading1 : lvl === 2 ? Heading2 : lvl === 3 ? Heading3 : Heading4
        return (
          <Toggle
            key={lvl}
            size="sm"
            pressed={editor.isActive("heading", { level: lvl })}
            onPressedChange={() => editor.chain().focus().toggleHeading({ level: lvl as 1 | 2 | 3 | 4 }).run()}
            aria-label={`Nadpis ${lvl}`}
          >
            <Icon className="h-4 w-4" />
          </Toggle>
        )
      })}

      <Separator orientation="vertical" className="mx-1 h-6" />

      <Toggle size="sm" pressed={editor.isActive("bulletList")} onPressedChange={() => editor.chain().focus().toggleBulletList().run()} aria-label="Odrážky">
        <List className="h-4 w-4" />
      </Toggle>
      <Toggle size="sm" pressed={editor.isActive("orderedList")} onPressedChange={() => editor.chain().focus().toggleOrderedList().run()} aria-label="Číslovaný seznam">
        <ListOrdered className="h-4 w-4" />
      </Toggle>
      <Toggle size="sm" pressed={editor.isActive("taskList")} onPressedChange={() => editor.chain().focus().toggleTaskList().run()} aria-label="Úkoly">
        <ListChecks className="h-4 w-4" />
      </Toggle>
      <Toggle size="sm" pressed={editor.isActive("blockquote")} onPressedChange={() => editor.chain().focus().toggleBlockquote().run()} aria-label="Citace">
        <Quote className="h-4 w-4" />
      </Toggle>
      <Toggle size="sm" pressed={editor.isActive("codeBlock")} onPressedChange={() => editor.chain().focus().toggleCodeBlock().run()} aria-label="Blok kódu">
        <Code className="h-4 w-4" />
      </Toggle>
      <Button type="button" size="sm" variant="ghost" className="h-8 px-2" onClick={() => editor.chain().focus().setHorizontalRule().run()} aria-label="Oddělovač">
        <Minus className="h-4 w-4" />
      </Button>

      <Separator orientation="vertical" className="mx-1 h-6" />

      <Button type="button" size="sm" variant="ghost" className="h-8 px-2" onClick={addLink} aria-label="Odkaz">
        <Link2 className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-8 px-2"
        onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
        aria-label="Tabulka"
      >
        <TableIcon className="h-4 w-4" />
      </Button>
      <Button type="button" size="sm" variant="ghost" className="h-8 px-2" onClick={addInlineMath} aria-label="Inline matematika">
        <Sigma className="h-4 w-4" />
      </Button>
      <Button type="button" size="sm" variant="ghost" className="h-8 px-2" onClick={addBlockMath} aria-label="Bloková matematika">
        <Sigma className="h-4 w-4" />
        <span className="ml-0.5 text-[10px]">∑</span>
      </Button>

      <Separator orientation="vertical" className="mx-1 h-6" />

      <Button type="button" size="sm" variant="ghost" className="h-8 px-2" disabled={uploading} onClick={() => imageInput.current?.click()} aria-label="Obrázek">
        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
      </Button>
      <Button type="button" size="sm" variant="ghost" className="h-8 px-2" disabled={uploading} onClick={() => annotateInput.current?.click()} aria-label="Kreslení / anotace">
        <Pencil className="h-4 w-4" />
      </Button>
      <Button type="button" size="sm" variant="ghost" className="h-8 px-2" onClick={() => editor.chain().focus().insertDoodle().run()} aria-label="Prázdné kreslení">
        <Pencil className="h-4 w-4" />
        <span className="ml-0.5 text-[10px]">+</span>
      </Button>

      <Separator orientation="vertical" className="mx-1 h-6" />

      <Button type="button" size="sm" variant="ghost" className="h-8 gap-1 px-2" onClick={pasteMarkdown} aria-label="Vložit Markdown">
        <ClipboardPaste className="h-4 w-4" />
        <span className="text-xs">MD</span>
      </Button>

      <Separator orientation="vertical" className="mx-1 h-6" />

      <Button type="button" size="sm" variant="ghost" className="h-8 px-2" onClick={() => editor.chain().focus().undo().run()} aria-label="Zpět">
        <Undo2 className="h-4 w-4" />
      </Button>
      <Button type="button" size="sm" variant="ghost" className="h-8 px-2" onClick={() => editor.chain().focus().redo().run()} aria-label="Vpřed">
        <Redo2 className="h-4 w-4" />
      </Button>

      <input
        ref={imageInput}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) handleImageFile(f)
          e.target.value = ""
        }}
      />
      <input
        ref={annotateInput}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) handleAnnotateFile(f)
          e.target.value = ""
        }}
      />
    </div>
  )
}
