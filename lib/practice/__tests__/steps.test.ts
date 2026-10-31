import { describe, it, expect } from "vitest"
import { isFinished, revealNext, stepButtonLabel } from "../steps"

describe("step reveal", () => {
  it("walks through the steps and reveals the result with the last one", () => {
    const total = 3
    const sequence = [0]
    while (!isFinished(sequence[sequence.length - 1], total)) sequence.push(revealNext(sequence[sequence.length - 1], total))
    expect(sequence).toEqual([0, 1, 2, 4])
    expect(sequence.map((s) => stepButtonLabel(s, total))).toEqual(["Krok 1", "Krok 2", "Krok 3", "Hotovo"])
  })

  it("shows the result straight away for an example without steps", () => {
    expect(stepButtonLabel(0, 0)).toBe("Výsledek")
    expect(revealNext(0, 0)).toBe(1)
    expect(isFinished(1, 0)).toBe(true)
  })

  it("stays finished", () => {
    expect(revealNext(4, 3)).toBe(4)
  })
})
