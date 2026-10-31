import { PRACTICE_INTRO_BLOCK_KINDS } from "@/lib/constants"
import type { PracticeIntroBlock } from "@/lib/practice/schema"

// Intro and closing cards of a practice page or module ("Zápis", "U zkoušky", notes), in
// their original order. The HTML was sanitized on import.
export function PracticeBlocks({ blocks }: { blocks: PracticeIntroBlock[] }) {
  return (
    <>
      {blocks.map((block, i) => (
        <div key={i} className={block.kind === PRACTICE_INTRO_BLOCK_KINDS.EXAM ? "card exam" : "card"}>
          {block.title && <h3>{block.title}</h3>}
          <div dangerouslySetInnerHTML={{ __html: block.html }} />
        </div>
      ))}
    </>
  )
}
