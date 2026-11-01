import { describe, expect, it } from "vitest"
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
