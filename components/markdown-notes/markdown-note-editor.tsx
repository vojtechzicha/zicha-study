"use client"

import "katex/dist/katex.min.css"
import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useEditor, EditorContent, type Editor } from "@tiptap/react"
import type { Content } from "@tiptap/core"
import { getNoteExtensions } from "@/components/markdown-notes/extensions"
import { EditorToolbar } from "@/components/markdown-notes/editor-toolbar"
import { NoteToc } from "@/components/markdown-notes/note-toc"
import { MarkdownNoteRenderer } from "@/components/markdown-notes/markdown-note-renderer"
import { NotePublishDialog } from "@/components/markdown-notes/note-publish-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { ArrowLeft, Globe, History, Check, Loader2, CloudOff } from "lucide-react"
import {
  saveMarkdownContent,
  commitMarkdownVersion,
  uploadMarkdownImage,
} from "@/lib/actions/markdown-notes"
import { updateStudyNoteAction } from "@/lib/actions/study-notes"
import { looksLikeMarkdown, markdownToEditorHtml } from "@/components/markdown-notes/markdown-import"
import type { MarkdownNoteEditorData, NoteContentJSON } from "@/lib/types/markdown-notes"

type SaveStatus = "idle" | "saving" | "saved" | "error"

interface MarkdownNoteEditorProps {
  note: MarkdownNoteEditorData
  studyId: string
  studySlug?: string | null
}

export function MarkdownNoteEditor({ note, studyId, studySlug }: MarkdownNoteEditorProps) {
  const router = useRouter()
  const [tab, setTab] = useState("editor")
  const [previewContent, setPreviewContent] = useState<NoteContentJSON | null>(null)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle")
  const [name, setName] = useState(note.name)
  const [isPublic, setIsPublic] = useState(note.is_public)
  const [publicSlug, setPublicSlug] = useState<string | null>(note.public_slug ?? null)
  const [showPublish, setShowPublish] = useState(false)

  const editorRef = useRef<Editor | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // True once the current editing session has produced an edit that is not yet
  // captured in a version snapshot.
  const dirtyForVersion = useRef(false)

  const noteId = note.id

  const insertImageFromFile = useCallback(
    async (file: File) => {
      const buf = await file.arrayBuffer()
      const res = await uploadMarkdownImage(noteId, buf, file.type || "image/png", file.name)
      if (res.url && editorRef.current) {
        editorRef.current.chain().focus().setImage({ src: res.url }).run()
      }
    },
    [noteId]
  )

  const editor = useEditor({
    immediatelyRender: false,
    extensions: getNoteExtensions(),
    content: (note.content_json ?? { type: "doc", content: [{ type: "paragraph" }] }) as Content,
    editorProps: {
      attributes: { class: "tiptap-note prose prose-slate max-w-none min-h-[60vh] px-4 py-6 focus:outline-none" },
      handlePaste: (_view, event) => {
        const files = Array.from(event.clipboardData?.files ?? [])
        const image = files.find((f) => f.type.startsWith("image/"))
        if (image) {
          event.preventDefault()
          void insertImageFromFile(image)
          return true
        }
        // Convert pasted Markdown (plain text only, no rich HTML on the clipboard)
        // into formatted content so headings/lists/etc. apply instead of staying literal.
        const text = event.clipboardData?.getData("text/plain") ?? ""
        const html = event.clipboardData?.getData("text/html") ?? ""
        if (text && !html && looksLikeMarkdown(text)) {
          event.preventDefault()
          editorRef.current?.chain().focus().insertContent(markdownToEditorHtml(text)).run()
          return true
        }
        return false
      },
      handleDrop: (_view, event) => {
        const files = Array.from((event as DragEvent).dataTransfer?.files ?? [])
        const image = files.find((f) => f.type.startsWith("image/"))
        if (image) {
          event.preventDefault()
          void insertImageFromFile(image)
          return true
        }
        return false
      },
    },
  })

  useEffect(() => {
    editorRef.current = editor
  }, [editor])

  // Debounced autosave of the working copy on every edit.
  const scheduleSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    setSaveStatus("saving")
    dirtyForVersion.current = true
    saveTimer.current = setTimeout(async () => {
      const ed = editorRef.current
      if (!ed) return
      const res = await saveMarkdownContent(noteId, ed.getJSON() as NoteContentJSON)
      setSaveStatus(res.error ? "error" : "saved")
    }, 1200)
  }, [noteId])

  useEffect(() => {
    if (!editor) return
    const handler = () => scheduleSave()
    editor.on("update", handler)
    return () => {
      editor.off("update", handler)
    }
  }, [editor, scheduleSave])

  // Commit a single version snapshot for this editing session, if edited.
  const commitVersion = useCallback(async () => {
    if (!dirtyForVersion.current) return
    const ed = editorRef.current
    if (!ed) return
    dirtyForVersion.current = false
    await commitMarkdownVersion(noteId, ed.getJSON() as NoteContentJSON)
  }, [noteId])

  // On leaving the editor (navigation away / unmount), snapshot a version.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden" && saveTimer.current) {
        // Flush any pending autosave immediately when the tab is backgrounded.
        const ed = editorRef.current
        if (ed) void saveMarkdownContent(noteId, ed.getJSON() as NoteContentJSON)
      }
    }
    document.addEventListener("visibilitychange", onHide)
    return () => {
      document.removeEventListener("visibilitychange", onHide)
      if (saveTimer.current) clearTimeout(saveTimer.current)
      void commitVersion()
    }
  }, [commitVersion, noteId])

  const handleTabChange = (value: string) => {
    if (value === "preview" && editor) {
      setPreviewContent(editor.getJSON() as NoteContentJSON)
    }
    setTab(value)
  }

  const handleNameBlur = async () => {
    const trimmed = name.trim()
    if (!trimmed || trimmed === note.name) return
    await updateStudyNoteAction(noteId, { name: trimmed })
  }

  const handleBack = () => {
    router.push(`/studies/${studyId}`)
  }

  return (
    <div className="flex h-screen flex-col bg-white">
      {/* Header */}
      <header className="flex items-center gap-3 border-b px-4 py-2">
        <Button variant="ghost" size="sm" onClick={handleBack} className="shrink-0">
          <ArrowLeft className="mr-1 h-4 w-4" />
          Zpět
        </Button>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={handleNameBlur}
          className="max-w-md border-transparent text-lg font-semibold shadow-none focus-visible:border-input"
          aria-label="Název zápisu"
        />
        <div className="ml-auto flex items-center gap-3">
          <SaveIndicator status={saveStatus} />
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPublish(true)}
            className={isPublic ? "border-primary-300 text-primary-700" : ""}
          >
            <Globe className="mr-1 h-4 w-4" />
            {isPublic ? "Sdíleno" : "Sdílet"}
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* TOC sidebar */}
        <aside className="hidden w-64 shrink-0 overflow-y-auto border-r bg-gray-50/60 p-3 md:block">
          <NoteToc editor={editor} onNavigate={() => setTab("editor")} />
        </aside>

        {/* Main panel */}
        <main className="flex min-w-0 flex-1 flex-col">
          <Tabs value={tab} onValueChange={handleTabChange} className="flex min-h-0 flex-1 flex-col">
            <TabsList className="m-2 self-start">
              <TabsTrigger value="editor">Editor</TabsTrigger>
              <TabsTrigger value="preview">Náhled</TabsTrigger>
              <TabsTrigger value="history">
                <History className="mr-1 h-4 w-4" />
                Historie
              </TabsTrigger>
            </TabsList>

            <TabsContent value="editor" className="mt-0 min-h-0 flex-1 overflow-y-auto">
              {editor && <EditorToolbar editor={editor} noteId={noteId} />}
              <EditorContent editor={editor} />
            </TabsContent>

            <TabsContent value="preview" className="mt-0 min-h-0 flex-1 overflow-y-auto px-4 py-6">
              <MarkdownNoteRenderer content={previewContent} />
            </TabsContent>

            <TabsContent value="history" className="mt-0 min-h-0 flex-1 overflow-y-auto px-4 py-6">
              <div className="mx-auto max-w-md rounded-lg border border-dashed p-8 text-center text-gray-500">
                <History className="mx-auto mb-3 h-10 w-10 text-gray-300" />
                <p className="font-medium">Historie verzí</p>
                <p className="mt-1 text-sm">
                  Verze se ukládají automaticky (posledních 50). Prohlížení a obnova
                  starších verzí bude k dispozici brzy.
                </p>
              </div>
            </TabsContent>
          </Tabs>
        </main>
      </div>

      <NotePublishDialog
        noteId={noteId}
        studySlug={studySlug ?? undefined}
        isPublic={isPublic}
        publicSlug={publicSlug}
        open={showPublish}
        onOpenChange={setShowPublish}
        onSaved={(next) => {
          setIsPublic(next.isPublic)
          setPublicSlug(next.publicSlug)
        }}
      />
    </div>
  )
}

function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === "saving") {
    return (
      <span className="flex items-center text-xs text-gray-500">
        <Loader2 className="mr-1 h-3 w-3 animate-spin" /> Ukládání…
      </span>
    )
  }
  if (status === "saved") {
    return (
      <span className="flex items-center text-xs text-green-600">
        <Check className="mr-1 h-3 w-3" /> Uloženo
      </span>
    )
  }
  if (status === "error") {
    return (
      <span className="flex items-center text-xs text-red-600">
        <CloudOff className="mr-1 h-3 w-3" /> Chyba ukládání
      </span>
    )
  }
  return null
}
