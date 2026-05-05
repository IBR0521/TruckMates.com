import { describe, expect, it } from "vitest"
import { parseX12 } from "../../lib/edi/x12"

describe("lib/edi/x12.ts", () => {
  it("parses a valid 204 payload", () => {
    const payload = [
      "ST*204*0001",
      "B2**CARRIER**TENDER123",
      "L11*SHIPREF1",
      "N1*SH*Shipper Co",
      "N3*123 Main St",
      "N4*Dallas*TX*75001",
      "N1*CN*Consignee Co",
      "N3*999 Broad St",
      "N4*Tulsa*OK*74101",
      "G62*10*20260505",
      "G62*17*20260506",
      "L3*42000",
    ].join("~")

    const result = parseX12(payload)
    expect(result.transactionSet).toBe("204")
    expect(result.data?.tenderNumber).toBe("TENDER123")
    expect(result.data?.shipmentReference).toBe("SHIPREF1")
    expect(result.data?.shipperState).toBe("TX")
    expect(result.data?.consigneeState).toBe("OK")
    expect(result.data?.weightLbs).toBe(42000)
  })

  it("handles malformed payload safely", () => {
    const malformed = "not-x12-content"
    const result = parseX12(malformed)
    expect(result.transactionSet).toBeNull()
    expect(result.data).toBeNull()
  })

  it("returns null for missing required fields in a 204 payload", () => {
    const missingFieldsPayload = ["ST*204*0002", "B2***", "N1*SH*", "N1*CN*"].join("~")
    const result = parseX12(missingFieldsPayload)
    expect(result.transactionSet).toBe("204")
    expect(result.data).not.toBeNull()
    expect(result.data?.tenderNumber).toBeNull()
    expect(result.data?.shipperName).toBeNull()
    expect(result.data?.consigneeAddress).toBeNull()
    expect(result.data?.pickupDate).toBeNull()
  })
})
