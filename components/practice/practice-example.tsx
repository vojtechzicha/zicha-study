"use client"

import { useEffect, useRef, useState } from "react"
import { Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { PracticeExample as Example } from "@/lib/practice/schema"
import { isFinished, revealNext, stepButtonLabel } from "@/lib/practice/steps"

// One worked example with the generators' step reveal: "Krok N" reveals the next step (the
// click that reveals the last step also reveals the result), then the button reads "Hotovo".
// "Celé řešení" reveals everything, "Skrýt řešení" hides it again. #all opens every example.
//
// The HTML fragments were sanitized on import (lib/practice/content.ts).

export function PracticeExample({
  example,
  done,
  onDoneChange,
}: {
  example: Example
  done: boolean
  onDoneChange: (_done: boolean) => void
}) {
  const total = example.steps.length
  const [shown, setShown] = useState(0)
  const sectionRef = useRef<HTMLElement>(null)
  const stepRefs = useRef<(HTMLDivElement | null)[]>([])
  const resultRef = useRef<HTMLDivElement>(null)
  const scrollTarget = useRef<"next" | "example" | null>(null)

  useEffect(() => {
    const openAll = () => {
      if (window.location.hash === "#all") setShown(total + 1)
    }
    openAll()
    window.addEventListener("hashchange", openAll)
    return () => window.removeEventListener("hashchange", openAll)
  }, [total])

  // Scroll after the revealed content has rendered
  useEffect(() => {
    const target = scrollTarget.current
    scrollTarget.current = null
    if (target === "next") {
      const el = shown > total ? resultRef.current : stepRefs.current[shown - 1]
      el?.scrollIntoView({ behavior: "smooth", block: "nearest" })
    } else if (target === "example") {
      sectionRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [shown, total])

  const finished = isFinished(shown, total)

  const next = () => {
    scrollTarget.current = "next"
    setShown(revealNext(shown, total))
  }

  return (
    <section ref={sectionRef} className="card example" id={`p${example.n}`}>
      <h2>
        Příklad {example.n}: {example.title}
      </h2>
      {example.source && <p className="meta">{example.source}</p>}
      <div dangerouslySetInnerHTML={{ __html: example.task_html }} />

      <div className="my-3.5 flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          onClick={next}
          disabled={finished}
          className="bg-gradient-to-r from-primary-600 to-primary-700 text-white hover:from-primary-700 hover:to-primary-800"
        >
          {stepButtonLabel(shown, total)}
        </Button>
        <Button size="sm" variant="outline" onClick={() => setShown(total + 1)}>
          Celé řešení
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            scrollTarget.current = "example"
            setShown(0)
          }}
        >
          Skrýt řešení
        </Button>
        <Button
          size="sm"
          variant="outline"
          aria-pressed={done}
          onClick={() => onDoneChange(!done)}
          className={cn(
            "ml-auto",
            done &&
              "border-green-300 bg-green-50 text-green-700 hover:bg-green-100 dark:border-green-800 dark:bg-green-950/40 dark:text-green-300 dark:hover:bg-green-900/40"
          )}
        >
          <Check className={cn("mr-1.5 h-4 w-4", !done && "opacity-40")} />
          Prošel jsem
        </Button>
      </div>

      {example.steps.map((step, i) => (
        <div
          key={i}
          ref={(el) => {
            stepRefs.current[i] = el
          }}
          className="step"
          hidden={i >= shown}
        >
          <h3>{step.title}</h3>
          {step.events_html.length > 0 && (
            <ol>
              {step.events_html.map((event, k) => (
                <li key={k} dangerouslySetInnerHTML={{ __html: event }} />
              ))}
            </ol>
          )}
          <div className="stepbody" dangerouslySetInnerHTML={{ __html: step.body_html }} />
        </div>
      ))}

      <div ref={resultRef} className="result" hidden={!finished}>
        <h3>Výsledek</h3>
        <div dangerouslySetInnerHTML={{ __html: example.result_html }} />
      </div>
    </section>
  )
}
