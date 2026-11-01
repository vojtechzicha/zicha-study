import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { SyncedTermInfo, isSyncedTerm } from "@/components/synced-term-info"
import type { ExamTermExternal } from "@/lib/constants"

const external: ExamTermExternal = {
  kind: "zkouška (písemná)",
  term_type: "řádný",
  room: "AII",
  examiners: "A. Novák",
  listed_by: null,
  capacity: 30,
  registered_count: 4,
  registration_from: "2026-11-30T00:00",
  registration_to: null,
  deregistration_to: null,
  status: "unavailable",
  status_note: "Přihlašování ještě nezačalo.",
  auto_locked: false,
  removed_at: null,
  synced_at: "2026-11-01T10:00:00.000Z",
}

describe("SyncedTermInfo", () => {
  it("renders nothing for a hand-made term", () => {
    expect(isSyncedTerm({ source: null, external: null })).toBe(false)
    expect(renderToStaticMarkup(<SyncedTermInfo term={{ source: null, external: null }} />)).toBe("")
  })

  it("shows the source, status and details", () => {
    const html = renderToStaticMarkup(<SyncedTermInfo term={{ source: "uis", external }} />)
    expect(html).toContain("UIS")
    expect(html).toContain("Nelze se přihlásit")
    expect(html).toContain("zkouška (písemná) · řádný · AII · A. Novák · 4/30 přihlášeno · Přihlašování od 30. 11.")
    expect(html).toContain("Přihlašování ještě nezačalo.")
    expect(html).not.toContain("už termín není")
  })

  it("keeps the compact form short and flags a dropped term", () => {
    const html = renderToStaticMarkup(
      <SyncedTermInfo term={{ source: "uis", external: { ...external, removed_at: "2026-11-02T08:00:00.000Z" } }} compact />
    )
    expect(html).toContain("AII")
    expect(html).not.toContain("A. Novák")
    expect(html).not.toContain("Přihlašování ještě nezačalo.")
    expect(html).toContain("V UIS už termín není")
  })
})
