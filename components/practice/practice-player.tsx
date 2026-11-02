"use client"

import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { morphInnerHtml } from "@/lib/practice/morph"
import type { PracticeAnimationFrame } from "@/lib/practice/schema"

// Step player for a tutorial animation: one frame at a time, with back/next, autoplay, restart,
// a clickable progress strip and ←/→ keys. The frame body (graph + state) is morphed in place
// between frames so the SVG's colours and strokes transition (app/practice-content.css) instead
// of the picture being swapped. With prefers-reduced-motion there are no transitions and no
// autoplay.
//
// The HTML fragments were sanitized on import (lib/practice/content.ts).

const AUTOPLAY_MS = 2500

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)")
    const update = () => setReduced(query.matches)
    update()
    query.addEventListener("change", update)
    return () => query.removeEventListener("change", update)
  }, [])
  return reduced
}

export function PracticePlayer({ frames, label }: { frames: PracticeAnimationFrame[]; label: string }) {
  const total = frames.length
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const reducedMotion = usePrefersReducedMotion()
  const bodyRef = useRef<HTMLDivElement>(null)
  const shownIndex = useRef(0)
  const frame = frames[index]
  const last = index === total - 1

  // React renders frame 1's body once (server HTML included); later frames are morphed in. The
  // prop object must stay the same: React 19 rewrites innerHTML whenever it gets a new object.
  const [initialBody] = useState(() => ({ __html: frames[0].body_html }))
  useLayoutEffect(() => {
    if (!bodyRef.current || shownIndex.current === index) return
    morphInnerHtml(bodyRef.current, frames[index].body_html)
    shownIndex.current = index
  }, [frames, index])

  // Autoplay stops on the last frame (reached by the timer or by hand).
  const autoplay = playing && !reducedMotion && !last
  useEffect(() => {
    if (!autoplay) return
    const timer = window.setTimeout(() => {
      setIndex(index + 1)
      if (index + 1 >= total - 1) setPlaying(false)
    }, AUTOPLAY_MS)
    return () => window.clearTimeout(timer)
  }, [autoplay, index, total])

  const go = (to: number | ((_current: number) => number)) => {
    const clamp = (i: number) => Math.max(0, Math.min(total - 1, i))
    setIndex((current) => clamp(typeof to === "function" ? to(current) : to))
    if (typeof to === "number" && clamp(to) === total - 1) setPlaying(false)
  }
  const step = (delta: number) => {
    if (delta > 0 && index + delta >= total - 1) setPlaying(false)
    go((current) => current + delta)
  }

  const togglePlay = () => {
    if (autoplay) {
      setPlaying(false)
      return
    }
    if (last) setIndex(0)
    setPlaying(true)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return
    if (event.key === "ArrowRight") {
      event.preventDefault()
      step(1)
    } else if (event.key === "ArrowLeft") {
      event.preventDefault()
      step(-1)
    }
  }

  return (
    <div
      className="anim rounded-lg focus-visible:outline-none"
      role="group"
      aria-roledescription="přehrávač"
      aria-label={label}
      tabIndex={0}
      onKeyDown={onKeyDown}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => step(-1)} disabled={index === 0}>
          ◀ Zpět
        </Button>
        <Button
          size="sm"
          onClick={() => step(1)}
          disabled={last}
          className="bg-gradient-to-r from-primary-600 to-primary-700 text-white hover:from-primary-700 hover:to-primary-800"
        >
          Další ▶
        </Button>
        {!reducedMotion && (
          <Button size="sm" variant="outline" onClick={togglePlay} aria-pressed={autoplay}>
            {autoplay ? "⏸ Pauza" : "▶ Přehrát"}
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setPlaying(false)
            go(0)
          }}
          disabled={index === 0 && !autoplay}
        >
          ⟲ Od začátku
        </Button>
        <span className="ml-auto text-sm tabular-nums text-muted-foreground" aria-live="polite">
          Krok {index + 1} / {total}
        </span>
      </div>

      <div className="mt-2.5 flex gap-1" role="group" aria-label="Kroky">
        {frames.map((f, i) => (
          <button
            key={i}
            type="button"
            onClick={() => go(i)}
            aria-label={`Krok ${i + 1}: ${f.title}`}
            aria-current={i === index ? "step" : undefined}
            title={f.title}
            className="group flex h-6 min-w-0 flex-1 items-center rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            <span
              className={cn(
                "h-1.5 w-full rounded-full transition-colors group-hover:h-2",
                i <= index ? "bg-primary-600 dark:bg-primary-400" : "bg-muted group-hover:bg-muted-foreground/30"
              )}
            />
          </button>
        ))}
      </div>

      <div className="frame">
        <h4>{frame.title}</h4>
        <div ref={bodyRef} className="framebody" dangerouslySetInnerHTML={initialBody} />
        {frame.events_html.length > 0 && (
          <ol>
            {frame.events_html.map((event, k) => (
              <li key={`${index}-${k}`} dangerouslySetInnerHTML={{ __html: event }} />
            ))}
          </ol>
        )}
        {frame.why_html && <p className="why" dangerouslySetInnerHTML={{ __html: frame.why_html }} />}
      </div>
    </div>
  )
}
