import { describe, expect, it } from "vitest"
import { compareExtractedToRecords } from "@/lib/ai/documents/discrepancy"

import clean from "./fixtures/clean-match.json"
import shorted from "./fixtures/shorted-rate.json"

describe("rate con / BOL discrepancy checks", () => {
  it("clean match yields no discrepancies", () => {
    const out = compareExtractedToRecords({
      extracted: clean.extracted as any,
      load: clean.load as any,
      invoice: clean.invoice as any,
    })
    expect(out.map((d) => d.key)).toEqual(clean.expected_discrepancy_keys)
  })

  it("shorted-rate mismatch flags expected keys", () => {
    const out = compareExtractedToRecords({
      extracted: shorted.extracted as any,
      load: shorted.load as any,
      invoice: shorted.invoice as any,
    })
    const keys = out.map((d) => d.key).sort()
    expect(keys).toEqual([...shorted.expected_discrepancy_keys].sort())
  })
})

