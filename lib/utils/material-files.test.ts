import { describe, expect, it } from "vitest"
import { isMaterialFile } from "./material-files"

describe("isMaterialFile", () => {
  it("accepts ZIP archives by MIME type or extension", () => {
    expect(isMaterialFile({ name: "skripta.zip", file: { mimeType: "application/x-zip-compressed" } })).toBe(true)
    expect(isMaterialFile({ name: "skripta.zip", file: { mimeType: "application/zip" } })).toBe(true)
    expect(isMaterialFile({ name: "SKRIPTA.ZIP", file: {} })).toBe(true)
  })

  it("accepts office documents and PDFs", () => {
    expect(isMaterialFile({ name: "a.pdf", file: { mimeType: "application/pdf" } })).toBe(true)
    expect(
      isMaterialFile({
        name: "a.docx",
        file: { mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
      })
    ).toBe(true)
  })

  it("rejects folders and other files", () => {
    expect(isMaterialFile({ name: "Složka" })).toBe(false)
    expect(isMaterialFile({ name: "foto.jpg", file: { mimeType: "image/jpeg" } })).toBe(false)
  })
})
