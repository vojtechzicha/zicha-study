import { describe, it, expect } from "vitest"
import { dedupeKeys, practiceExampleKey } from "../keys"

describe("practiceExampleKey", () => {
  it("matches the generators' algorithm", () => {
    expect(practiceExampleKey("gcd(58, 15): ověření před hledáním inverze")).toBe("gcd-58-15-overeni-pred-hledanim-inverze")
  })

  it("strips diacritics and symbols", () => {
    expect(practiceExampleKey("Příklad – Ř, ů, ě → x²")).toBe("priklad-r-u-e-x")
    expect(practiceExampleKey("Ocenění podniku metodou EVA")).toBe("oceneni-podniku-metodou-eva")
  })

  it("cuts at 80 characters before trimming hyphens", () => {
    const title = `${"a".repeat(79)} b`
    const key = practiceExampleKey(title)
    expect(key).toBe("a".repeat(79))
    expect(key.endsWith("-")).toBe(false)
  })

  it("falls back to priklad", () => {
    expect(practiceExampleKey("→ ← …")).toBe("priklad")
  })
})

describe("dedupeKeys", () => {
  it("appends -2, -3 and skips taken suffixes", () => {
    expect(dedupeKeys(["a", "a", "a"])).toEqual(["a", "a-2", "a-3"])
    expect(dedupeKeys(["a-2", "a", "a"])).toEqual(["a-2", "a", "a-3"])
  })
})
