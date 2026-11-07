import { describe, expect, it } from "vitest"
import { planMaterialIndexRebuilds } from "./material-indexes"

describe("planMaterialIndexRebuilds", () => {
  it("makes unique indexes over OneDrive fields partial", () => {
    expect(
      planMaterialIndexRebuilds([
        { name: "_id_", key: { _id: 1 } },
        { name: "study_id_1_onedrive_id_1", key: { study_id: 1, onedrive_id: 1 }, unique: true },
      ])
    ).toEqual([
      {
        name: "study_id_1_onedrive_id_1",
        key: { study_id: 1, onedrive_id: 1 },
        partialFilterExpression: { onedrive_id: { $type: "string" } },
      },
    ])
  })

  it("covers every OneDrive key of the index", () => {
    const [rebuild] = planMaterialIndexRebuilds([
      { name: "file", key: { parent_path: 1, file_name: 1 }, unique: true },
    ])
    expect(rebuild.partialFilterExpression).toEqual({ parent_path: { $type: "string" }, file_name: { $type: "string" } })
  })

  it("leaves other indexes alone", () => {
    expect(
      planMaterialIndexRebuilds([
        { name: "study_id_1", key: { study_id: 1 } },
        { name: "onedrive_id_1", key: { onedrive_id: 1 } },
        { name: "study_slug", key: { study_id: 1, public_slug: 1 }, unique: true },
        {
          name: "already_partial",
          key: { onedrive_id: 1 },
          unique: true,
          partialFilterExpression: { onedrive_id: { $type: "string" } },
        },
      ])
    ).toEqual([])
  })
})
