"use client"

import { useEffect, useState, useCallback } from "react"
import type { Editor } from "@tiptap/react"
import { ListTree } from "lucide-react"

interface Heading {
  level: number
  text: string
  pos: number
}

interface NoteTocProps {
  editor: Editor | null
  // Called before scrolling so the shell can switch to the Editor tab.
  onNavigate?: () => void
}

export function NoteToc({ editor, onNavigate }: NoteTocProps) {
  const [headings, setHeadings] = useState<Heading[]>([])

  const recompute = useCallback(() => {
    if (!editor) return
    const items: Heading[] = []
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === "title") {
        // The document Title sits at the top of the outline.
        items.push({ level: 0, text: node.textContent || "(bez názvu)", pos })
      } else if (node.type.name === "heading") {
        items.push({
          level: node.attrs.level as number,
          text: node.textContent || "(bez názvu)",
          pos,
        })
      }
    })
    setHeadings(items)
  }, [editor])

  useEffect(() => {
    if (!editor) return
    // Defer the initial computation so we don't setState synchronously in the effect.
    queueMicrotask(recompute)
    editor.on("update", recompute)
    editor.on("create", recompute)
    return () => {
      editor.off("update", recompute)
      editor.off("create", recompute)
    }
  }, [editor, recompute])

  const goTo = (pos: number) => {
    if (!editor) return
    onNavigate?.()
    // Defer so the Editor tab is mounted/visible before we scroll.
    requestAnimationFrame(() => {
      const dom = editor.view.nodeDOM(pos) as HTMLElement | null
      dom?.scrollIntoView?.({ behavior: "smooth", block: "start" })
      editor.commands.focus(pos + 1)
    })
  }

  return (
    <nav className="text-sm">
      <div className="flex items-center gap-2 px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <ListTree className="h-4 w-4" />
        Obsah
      </div>
      {headings.length === 0 ? (
        <p className="px-2 text-xs text-muted-foreground/70">Obsah se sestaví z nadpisů.</p>
      ) : (
        <ul className="space-y-0.5">
          {headings.map((h, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => goTo(h.pos)}
                className={`block w-full truncate rounded px-2 py-1 text-left hover:bg-primary-50 hover:text-primary-700 dark:hover:bg-primary-900/40 dark:hover:text-primary-300 ${h.level === 0 ? "font-semibold text-foreground" : "text-foreground/80"}`}
                style={{ paddingLeft: `${Math.max(0, h.level - 1) * 12 + 8}px` }}
                title={h.text}
              >
                {h.text}
              </button>
            </li>
          ))}
        </ul>
      )}
    </nav>
  )
}
