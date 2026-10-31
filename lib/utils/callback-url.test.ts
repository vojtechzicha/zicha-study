import { describe, it, expect } from "vitest"
import { safeCallbackUrl } from "./callback-url"

describe("safeCallbackUrl", () => {
  it("keeps same-site paths with their query", () => {
    expect(safeCallbackUrl("/fim/procvicovani/dmo/bfs")).toBe("/fim/procvicovani/dmo/bfs")
    expect(safeCallbackUrl("/fim/procvicovani/dmo?x=1")).toBe("/fim/procvicovani/dmo?x=1")
    expect(safeCallbackUrl(["/a", "/b"])).toBe("/a")
  })

  it("rejects other origins and odd forms", () => {
    for (const value of ["https://evil.example", "//evil.example", "/\\evil.example", "/a\\b", "javascript:alert(1)", "a/b", "/a\nb", "", null, undefined]) {
      expect(safeCallbackUrl(value as string), String(value)).toBe("/")
    }
  })
})
