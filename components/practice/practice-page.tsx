"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { Check } from "lucide-react"
import { PracticeShell } from "./practice-shell"
import { PracticeExample } from "./practice-example"
import { PracticeBlocks } from "./practice-blocks"
import { setPracticeProgressAction } from "@/lib/actions/practice"
import type { PracticePageView } from "@/lib/practice/view"

// A practice page: back link, title, lead, intro cards, the example list (with ✓ for examples
// gone through), the examples and the closing verification note.
export function PracticePage({ view, indexHref }: { view: PracticePageView; indexHref: string }) {
  const { page } = view
  const [done, setDone] = useState(() => new Set(view.done))
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const setExampleDone = (key: string, value: boolean) => {
    const previous = new Set(done)
    const next = new Set(done)
    if (value) next.add(key)
    else next.delete(key)
    setDone(next)
    setError(null)
    startTransition(async () => {
      const result = await setPracticeProgressAction(page.id, key, value)
      if (result.error) {
        setDone(previous)
        setError("Nepodařilo se uložit postup.")
      }
    })
  }

  const doneCount = page.examples.filter((ex) => done.has(ex.key)).length

  return (
    <PracticeShell logoUrl={view.study.logoUrl} flavour={view.module.flavour}>
      <p className="back">
        <Link href={indexHref}>← {view.module.title}</Link>
      </p>
      <h1>{page.title}</h1>
      {page.leadHtml && <p className="lead" dangerouslySetInnerHTML={{ __html: page.leadHtml }} />}
      <PracticeBlocks blocks={page.introBlocks} />

      {error && (
        <p role="alert" className="sticky top-2 z-10 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}

      <nav className="card" aria-label="Příklady">
        <h3>
          Příklady{" "}
          <span className="meta">
            ({doneCount} / {page.examples.length} prošlých)
          </span>
        </h3>
        <ol>
          {page.examples.map((ex) => (
            <li key={ex.key}>
              <a href={`#p${ex.n}`}>{ex.title}</a>
              {ex.nav_meta && <span className="meta"> ({ex.nav_meta})</span>}
              {done.has(ex.key) && (
                <Check className="ml-1.5 inline h-4 w-4 text-green-600 dark:text-green-400" aria-label="prošlý" />
              )}
            </li>
          ))}
        </ol>
      </nav>

      {page.examples.map((ex) => (
        <PracticeExample
          key={ex.key}
          example={ex}
          done={done.has(ex.key)}
          onDoneChange={(value) => setExampleDone(ex.key, value)}
        />
      ))}

      {page.footerHtml && <p className="meta" dangerouslySetInnerHTML={{ __html: page.footerHtml }} />}
    </PracticeShell>
  )
}
