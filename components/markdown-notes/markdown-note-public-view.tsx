import Link from "next/link"
import { ArrowLeft, BookOpen } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { PublicPageFooter } from "@/components/public-page-footer"
import { MarkdownNoteRenderer } from "@/components/markdown-notes/markdown-note-renderer"
import { coerceNoteContent, type NoteContentJSON } from "@/lib/types/markdown-notes"

interface PublicSubject {
  id: string
  name: string
  abbreviation: string | null
  is_primary: boolean
}

interface MarkdownNotePublicViewProps {
  note: {
    name: string
    description?: string | null
    content_json?: NoteContentJSON | null
    updated_at?: string | null
    content_updated_at?: string | null
  }
  study: { name: string; public_slug?: string | null }
  studySlug: string
  subjects: PublicSubject[]
}

export function MarkdownNotePublicView({ note, study, studySlug, subjects }: MarkdownNotePublicViewProps) {
  const updated = note.content_updated_at || note.updated_at
  return (
    <div className="min-h-screen bg-primary-50 dark:bg-primary-950">
      <div className="mx-auto max-w-4xl p-4">
        <Link href={`/${studySlug}`} className="mb-4 inline-flex items-center text-primary hover:text-primary/80">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Zpět na {study.name}
        </Link>

        <div className="mb-4 flex items-start gap-3">
          <BookOpen className="mt-1 h-7 w-7 shrink-0 text-primary-600 dark:text-primary-400" />
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-foreground">{note.name}</h1>
            {note.description && <p className="mt-1 text-muted-foreground">{note.description}</p>}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {subjects.map((s) => (
                <Badge key={s.id} variant={s.is_primary ? "secondary" : "outline"} className="text-xs">
                  {s.abbreviation || s.name}
                </Badge>
              ))}
              {updated && (
                <span className="text-xs text-muted-foreground">
                  Aktualizováno {new Date(updated).toLocaleDateString("cs-CZ")}
                </span>
              )}
            </div>
          </div>
        </div>

        <article className="rounded-xl border-0 bg-card p-6 shadow-xl md:p-8">
          <MarkdownNoteRenderer content={coerceNoteContent(note.content_json)} />
        </article>

        <PublicPageFooter studyName={study.name} studySlug={study.public_slug} />
      </div>
    </div>
  )
}
