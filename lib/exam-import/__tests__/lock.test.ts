import { describe, expect, it } from "vitest"
import { userLockOwnershipPatch } from "@/lib/exam-import/lock"

const autoLocked = { locked: true, external: { auto_locked: true } }

describe("userLockOwnershipPatch", () => {
  it("takes the lock over when the user changes it", () => {
    expect(userLockOwnershipPatch(autoLocked, { locked: false })).toEqual({ "external.auto_locked": false })
  })

  it("leaves the flag when the lock doesn't change", () => {
    // The editor saves every term with its lock, changed or not.
    expect(userLockOwnershipPatch(autoLocked, { locked: true, note: "x" })).toEqual({})
    expect(userLockOwnershipPatch(autoLocked, { note: "x" })).toEqual({})
  })

  it("ignores hand-made terms, user-owned locks and patches that set external", () => {
    expect(userLockOwnershipPatch({ locked: true }, { locked: false })).toEqual({})
    expect(userLockOwnershipPatch({ locked: true, external: { auto_locked: false } }, { locked: false })).toEqual({})
    expect(userLockOwnershipPatch(autoLocked, { locked: false, external: {} })).toEqual({})
    expect(userLockOwnershipPatch(null, { locked: false })).toEqual({})
  })
})
