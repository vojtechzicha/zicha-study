import StarterKit from "@tiptap/starter-kit"
import Image from "@tiptap/extension-image"
import Placeholder from "@tiptap/extension-placeholder"
import { Table } from "@tiptap/extension-table"
import TableRow from "@tiptap/extension-table-row"
import TableHeader from "@tiptap/extension-table-header"
import TableCell from "@tiptap/extension-table-cell"
import TaskList from "@tiptap/extension-task-list"
import TaskItem from "@tiptap/extension-task-item"
import { Mathematics } from "@tiptap/extension-mathematics"
import type { Extensions } from "@tiptap/core"
import { Doodle } from "@/components/markdown-notes/doodle-extension"

// Shared extension set for the Markdown note editor and its read-only renderer.
// Keeping a single source of truth guarantees the editor, the Preview tab and
// the public view all render documents identically.
export function getNoteExtensions(options?: { placeholder?: string }): Extensions {
  return [
    StarterKit.configure({
      link: { openOnClick: false, HTMLAttributes: { rel: "noopener noreferrer nofollow" } },
    }),
    Image.configure({ inline: false, allowBase64: false }),
    Table.configure({ resizable: true }),
    TableRow,
    TableHeader,
    TableCell,
    TaskList,
    TaskItem.configure({ nested: true }),
    Mathematics.configure({
      katexOptions: { throwOnError: false },
    }),
    Doodle,
    Placeholder.configure({
      placeholder: options?.placeholder ?? "Začněte psát… (Markdown zkratky, $latex$, /table)",
    }),
  ]
}
