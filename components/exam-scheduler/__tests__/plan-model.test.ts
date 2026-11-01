import { describe, expect, it } from "vitest"
import colors from "tailwindcss/colors"
import { STUDY_TONES, STUDY_TONE_FAMILIES, pickStudyTones } from "../plan-model"

describe("pickStudyTones", () => {
  it("takes the colour family nearest to each logo (ČZU red, UHK light blue)", () => {
    const tones = pickStudyTones([
      { id: "fim", hsl: [195, 85, 47] },
      { id: "czu", hsl: [0, 82, 43] },
    ])
    expect(tones.get("czu")).toBe(STUDY_TONE_FAMILIES.red.tone)
    expect(tones.get("fim")).toBe(STUDY_TONE_FAMILIES.sky.tone)
  })

  it("never gives two studies the same family; the more saturated logo chooses first", () => {
    const tones = pickStudyTones([
      { id: "a", hsl: [355, 50, 40] },
      { id: "b", hsl: [2, 90, 45] },
    ])
    expect(tones.get("b")).toBe(STUDY_TONE_FAMILIES.red.tone)
    expect(tones.get("a")).toBe(STUDY_TONE_FAMILIES.rose.tone)
  })

  it("falls back to the default tones for grey or missing logos", () => {
    const tones = pickStudyTones([
      { id: "grey", hsl: [210, 5, 40] },
      { id: "none" },
      { id: "teal", hsl: [173, 80, 40] },
    ])
    expect(tones.get("teal")).toBe(STUDY_TONE_FAMILIES.teal.tone)
    // The default teal is taken by the teal logo, so the others continue with violet and sky.
    expect([tones.get("grey")!.swatch, tones.get("none")!.swatch]).toEqual([STUDY_TONES[1].swatch, STUDY_TONES[2].swatch])
  })

  it("never uses amber", () => {
    const tones = pickStudyTones([{ id: "x", hsl: [45, 90, 50] }])
    expect(tones.get("x")!.swatch).not.toContain("amber")
  })
})

describe("study tone contrast", () => {
  const palette = colors as unknown as Record<string, Record<string, string>>
  const lum = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }
  const ratio = (a: string, b: string) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
    return (x + 0.05) / (y + 0.05)
  }
  const color = (cls: string) => {
    const [, family, shade] = cls.match(/-(\w+)-(\d+)$/) || []
    return family === "white" || cls.endsWith("-white") ? "#ffffff" : palette[family][shade]
  }

  it.each(Object.entries(STUDY_TONE_FAMILIES))("%s: the solid chip reaches 4.5:1 in light and dark mode", (_f, { tone }) => {
    const parts = tone.solid.split(" ")
    const light = [parts.find((c) => c.startsWith("bg-"))!, parts.find((c) => c.startsWith("text-"))!]
    const dark = [parts.find((c) => c.startsWith("dark:bg-"))!, parts.find((c) => c.startsWith("dark:text-"))!]
    expect(ratio(color(light[0]), color(light[1]))).toBeGreaterThanOrEqual(4.5)
    expect(ratio(color(dark[0]), color(dark[1]))).toBeGreaterThanOrEqual(4.5)
  })

  it("the default tones are logo families with the same shades", () => {
    expect(STUDY_TONES.map((t) => t.swatch)).toEqual(["bg-teal-500", "bg-violet-500", "bg-sky-500", "bg-rose-500"])
  })
})
