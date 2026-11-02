"use client"

import { useState, useSyncExternalStore } from "react"
import { ChevronDown } from "lucide-react"
import { PRACTICE_INTRO_BLOCK_KINDS } from "@/lib/constants"
import type { PracticeIntroBlock } from "@/lib/practice/schema"
import { czPlural } from "@/lib/utils/task-format"
import { PracticePlayer } from "./practice-player"

// Intro and closing cards of a practice page or module ("Zápis", "U zkoušky", notes), in
// their original order. Consecutive tutorial cards form a collapsible "Návod" section; with a
// `storageKey` its collapsed state is remembered in this browser. The HTML was sanitized on
// import.

type Run = { tutorial: false; block: PracticeIntroBlock; index: number } | { tutorial: true; blocks: PracticeIntroBlock[]; index: number }

function runs(blocks: PracticeIntroBlock[]): Run[] {
  const out: Run[] = []
  blocks.forEach((block, index) => {
    const prev = out[out.length - 1]
    if (block.kind !== PRACTICE_INTRO_BLOCK_KINDS.TUTORIAL) out.push({ tutorial: false, block, index })
    else if (prev?.tutorial) prev.blocks.push(block)
    else out.push({ tutorial: true, blocks: [block], index })
  })
  return out
}

function BlockCard({ block }: { block: PracticeIntroBlock }) {
  const className =
    block.kind === PRACTICE_INTRO_BLOCK_KINDS.EXAM
      ? "card exam"
      : block.kind === PRACTICE_INTRO_BLOCK_KINDS.TUTORIAL
        ? "card tutorial"
        : "card"
  return (
    <div className={className}>
      {block.title && <h3>{block.title}</h3>}
      {block.html && <div dangerouslySetInnerHTML={{ __html: block.html }} />}
      {block.frames && <PracticePlayer frames={block.frames} label={block.title ?? "Ukázka krok za krokem"} />}
      {block.after_html && <div dangerouslySetInnerHTML={{ __html: block.after_html }} />}
    </div>
  )
}

// Collapsed state per storage key, in localStorage (or in memory when storage is blocked).
const memory = new Map<string, boolean>()
const listeners = new Set<() => void>()

function readCollapsed(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === "collapsed"
  } catch {
    return memory.get(key) ?? false
  }
}

function writeCollapsed(key: string, collapsed: boolean) {
  try {
    if (collapsed) window.localStorage.setItem(key, "collapsed")
    else window.localStorage.removeItem(key)
  } catch {
    memory.set(key, collapsed)
  }
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  window.addEventListener("storage", listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener("storage", listener)
  }
}

function TutorialSection({
  blocks,
  open,
  onToggle,
  id,
}: {
  blocks: PracticeIntroBlock[]
  open: boolean
  onToggle: () => void
  id: string
}) {
  return (
    <section className="tutorials" aria-labelledby={`${id}-heading`}>
      <h2 id={`${id}-heading`}>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={id}
          className="flex w-full items-center gap-2 rounded-md text-left hover:text-primary-700 dark:hover:text-primary-300"
        >
          <ChevronDown className={open ? "h-5 w-5 transition-transform" : "h-5 w-5 -rotate-90 transition-transform"} aria-hidden />
          Návod
          {!open && (
            <span className="text-sm font-normal text-muted-foreground">
              ({blocks.length} {czPlural(blocks.length, "část", "části", "částí")})
            </span>
          )}
        </button>
      </h2>
      <div id={id} hidden={!open}>
        {blocks.map((block, i) => (
          <BlockCard key={i} block={block} />
        ))}
      </div>
    </section>
  )
}

export function PracticeBlocks({ blocks, storageKey }: { blocks: PracticeIntroBlock[]; storageKey?: string }) {
  // Expanded on the server; the remembered state applies once hydrated.
  const stored = useSyncExternalStore(
    subscribe,
    () => (storageKey ? readCollapsed(storageKey) : false),
    () => false
  )
  const [local, setLocal] = useState(false)
  const collapsed = storageKey ? stored : local

  const toggle = () => {
    if (storageKey) writeCollapsed(storageKey, !collapsed)
    else setLocal(!collapsed)
  }

  return (
    <>
      {runs(blocks).map((run) =>
        run.tutorial ? (
          <TutorialSection
            key={run.index}
            id={`tutorial-${run.index}`}
            blocks={run.blocks}
            open={!collapsed}
            onToggle={toggle}
          />
        ) : (
          <BlockCard key={run.index} block={run.block} />
        )
      )}
    </>
  )
}
