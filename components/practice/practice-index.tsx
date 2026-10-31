"use client"

import Link from "next/link"
import { BookOpen, Check } from "lucide-react"
import { PracticeShell } from "./practice-shell"
import { PracticeBlocks } from "./practice-blocks"
import { czPlural } from "@/lib/utils/task-format"
import type { PracticeModuleView } from "@/lib/practice/view"

// The module index: back link to the study, intro, a link to the subject's study note, the pages
// by group with their progress, and the closing cards.
// basePath: the module index path; pages live at `${basePath}/${slug}`
export function PracticeIndex({ view, basePath }: { view: PracticeModuleView; basePath: string }) {
  const { module, totals } = view

  return (
    <PracticeShell logoUrl={view.study.logoUrl} flavour={module.flavour}>
      <p className="back">
        <Link href={`/studies/${view.study.id}`}>← {view.study.name}</Link>
      </p>
      <h1>Procvičování – {module.title}</h1>
      {module.introHtml && <div className="lead" dangerouslySetInnerHTML={{ __html: module.introHtml }} />}
      {totals.examples > 0 && (
        <p className="meta">
          {totals.done} / {totals.examples} {czPlural(totals.examples, "příklad", "příklady", "příkladů")} prošlých
        </p>
      )}
      {view.primaryNote && (
        <p>
          <BookOpen className="mr-1.5 inline h-4 w-4 align-[-2px]" aria-hidden="true" />
          <a
            href={view.primaryNote.href}
            {...(view.primaryNote.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          >
            {view.primaryNote.name}
          </a>
        </p>
      )}
      <PracticeBlocks blocks={module.introBlocks} />

      {view.groups.length === 0 && <p className="meta">Zatím žádné stránky.</p>}
      {view.groups.map((group) => (
        <section key={group.id} aria-labelledby={`g-${group.id}`}>
          <h2 id={`g-${group.id}`} className="mt-8">
            {group.title}
          </h2>
          {group.description && <p className="meta">{group.description}</p>}
          <div className="grid">
            {group.pages.map((page) => (
              <div key={page.id} className="card">
                <h3>
                  <Link href={`${basePath}/${page.slug}`}>{page.title}</Link>
                </h3>
                {page.desc && <p className="meta">{page.desc}</p>}
                <p className="meta">
                  {page.examples} {czPlural(page.examples, "příklad", "příklady", "příkladů")}
                  {page.done > 0 && (
                    <>
                      {" "}· {page.done === page.examples && <Check className="inline h-3.5 w-3.5 align-[-2px] text-green-600 dark:text-green-400" aria-hidden="true" />}
                      {page.done} prošlých
                    </>
                  )}
                </p>
              </div>
            ))}
          </div>
        </section>
      ))}

      <PracticeBlocks blocks={module.closingBlocks} />
    </PracticeShell>
  )
}
