import StarterKit from "@tiptap/starter-kit"
import Image from "@tiptap/extension-image"
import Placeholder from "@tiptap/extension-placeholder"
import { Table } from "@tiptap/extension-table"
import TableRow from "@tiptap/extension-table-row"
import TableHeader from "@tiptap/extension-table-header"
import TableCell from "@tiptap/extension-table-cell"
import TaskList from "@tiptap/extension-task-list"
import TaskItem from "@tiptap/extension-task-item"
import type { Extensions } from "@tiptap/core"
import { mathExtensions } from "@/components/markdown-notes/math-extensions"
import { Doodle } from "@/components/markdown-notes/doodle-extension"
import { Title } from "@/components/markdown-notes/title-extension"

// Shared extension set for the Markdown note editor and its read-only renderer.
// Keeping a single source of truth guarantees the editor, the Preview tab and
// the public view all render documents identically.
export function getNoteExtensions(options?: { placeholder?: string }): Extensions {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3, 4] },
      link: { openOnClick: false, HTMLAttributes: { rel: "noopener noreferrer nofollow" } },
    }),
    Title,
    Image.configure({ inline: false, allowBase64: false }),
    Table.configure({ resizable: true }),
    TableRow,
    TableHeader,
    TableCell,
    TaskList,
    TaskItem.configure({ nested: true }),
    ...mathExtensions,
    Doodle,
    Placeholder.configure({
      placeholder: options?.placeholder ?? "Začněte psát… (Markdown zkratky, $latex$, /table)",
    }),
  ]
}
