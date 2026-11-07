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
        replacementName: "study_id_1_onedrive_id_1_files",
        key: { study_id: 1, onedrive_id: 1 },
        partialFilterExpression: { onedrive_id: { $exists: true } },
      },
    ])
  })

  it("covers every OneDrive key of the index, numeric ones included", () => {
    const [rebuild] = planMaterialIndexRebuilds([
      { name: "file", key: { onedrive_id: 1, file_size: 1 }, unique: true },
    ])
    expect(rebuild.partialFilterExpression).toEqual({ onedrive_id: { $exists: true }, file_size: { $exists: true } })
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
          partialFilterExpression: { onedrive_id: { $exists: true } },
        },
      ])
    ).toEqual([])
  })
})
