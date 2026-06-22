"use client"

import { use, useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { MarkdownNoteEditor } from "@/components/markdown-notes/markdown-note-editor"
import { fetchMarkdownNote } from "@/lib/actions/markdown-notes"
import { fetchStudy } from "@/lib/actions/studies"
import { NOTE_TYPES } from "@/lib/constants"
import type { MarkdownNoteEditorData } from "@/lib/types/markdown-notes"

export default function MarkdownNoteEditorPage({
  params,
}: {
  params: Promise<{ id: string; noteId: string }>
}) {
  const { id, noteId } = use(params)
  const { status } = useSession()
  const router = useRouter()
  const [note, setNote] = useState<MarkdownNoteEditorData | null>(null)
  const [studySlug, setStudySlug] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (status !== "authenticated") return
    let cancelled = false

    const load = async () => {
      const [noteRes, study] = await Promise.all([fetchMarkdownNote(noteId), fetchStudy(id)])
      if (cancelled) return

      if (noteRes.error || !noteRes.data) {
        setError("Zápis nenalezen")
        setLoading(false)
        return
      }
      const data = noteRes.data as unknown as MarkdownNoteEditorData
      if (data.note_type !== NOTE_TYPES.MARKDOWN) {
        // Word notes are not edited here.
        router.replace(`/studies/${id}`)
        return
      }
      setNote(data)
      setStudySlug((study as { public_slug?: string | null } | null)?.public_slug ?? null)
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [status, noteId, id, router])

  if (status === "loading" || loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    )
  }

  if (error || !note) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 text-gray-600">
        <p>{error ?? "Zápis nenalezen"}</p>
        <button className="text-primary-600 underline" onClick={() => router.push(`/studies/${id}`)}>
          Zpět na studium
        </button>
      </div>
    )
  }

  return <MarkdownNoteEditor note={note} studyId={id} studySlug={studySlug} />
}
