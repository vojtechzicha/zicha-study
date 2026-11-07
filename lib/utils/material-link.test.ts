import { describe, expect, it } from "vitest"
import {
  getLinkHost,
  getMaterialOpenUrl,
  getMaterialSubtitle,
  normalizeLinkUrl,
  prepareMaterialData,
} from "./material-link"

describe("normalizeLinkUrl", () => {
  it("keeps http(s) addresses", () => {
    expect(normalizeLinkUrl("https://www.figma.com/file/abc")).toBe("https://www.figma.com/file/abc")
    expect(normalizeLinkUrl("  http://example.com  ")).toBe("http://example.com/")
  })

  it("adds https:// when the scheme is missing", () => {
    expect(normalizeLinkUrl("github.com/team/projekt")).toBe("https://github.com/team/projekt")
    expect(normalizeLinkUrl("//docs.google.com/x")).toBe("https://docs.google.com/x")
  })

  it("refuses other schemes and non-addresses", () => {
    expect(normalizeLinkUrl("javascript:alert(1)")).toBeNull()
    expect(normalizeLinkUrl("JavaScript:alert(1)")).toBeNull()
    expect(normalizeLinkUrl("data:text/html,<b>x</b>")).toBeNull()
    expect(normalizeLinkUrl("mailto:a@b.cz")).toBeNull()
    expect(normalizeLinkUrl("skupinový projekt")).toBeNull()
    expect(normalizeLinkUrl("https://intranet")).toBeNull()
    expect(normalizeLinkUrl("")).toBeNull()
    expect(normalizeLinkUrl(null)).toBeNull()
  })
})

describe("getLinkHost", () => {
  it("drops www.", () => {
    expect(getLinkHost("https://www.figma.com/file/abc")).toBe("figma.com")
    expect(getLinkHost("https://miro.com/app/board")).toBe("miro.com")
  })
})

describe("display helpers", () => {
  const link = { material_type: "link", link_url: "https://www.notion.so/projekt", file_name: null }
  const file = { file_name: "zadani.pdf", onedrive_web_url: "https://onedrive.live.com/x" }

  it("open a link material at its address and a file in OneDrive", () => {
    expect(getMaterialOpenUrl(link)).toBe("https://www.notion.so/projekt")
    expect(getMaterialOpenUrl(file)).toBe("https://onedrive.live.com/x")
    expect(getMaterialOpenUrl({ material_type: "link", link_url: "javascript:alert(1)" })).toBeUndefined()
  })

  it("show the host or the file name under the name", () => {
    expect(getMaterialSubtitle(link)).toBe("notion.so")
    expect(getMaterialSubtitle(file)).toBe("zadani.pdf")
  })
})

describe("prepareMaterialData", () => {
  it("leaves data that doesn't touch the type alone", () => {
    const data = { is_public: true, public_slug: "projekt" }
    expect(prepareMaterialData(data)).toBe(data)
  })

  it("normalizes the link and strips OneDrive fields", () => {
    expect(
      prepareMaterialData({
        study_id: "s1",
        material_type: "link",
        link_url: "figma.com/file/abc",
        name: "Projekt",
        onedrive_id: "x",
        file_name: "a.pdf",
      })
    ).toEqual({ study_id: "s1", material_type: "link", link_url: "https://figma.com/file/abc", name: "Projekt" })
  })

  it("rejects an invalid link", () => {
    expect(() => prepareMaterialData({ material_type: "link", link_url: "javascript:alert(1)" })).toThrow(
      "Zadejte platný odkaz"
    )
    expect(() => prepareMaterialData({ material_type: "link" })).toThrow()
  })

  it("rejects a link on a file material", () => {
    expect(() => prepareMaterialData({ material_type: "file", link_url: "https://a.cz" })).toThrow()
    expect(prepareMaterialData({ material_type: "file", name: "a" })).toEqual({ material_type: "file", name: "a" })
  })
})
