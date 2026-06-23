import { beforeEach, describe, expect, it, vi } from "vitest"

const queryLog: Array<{ table: string; companyId: string; minCount: number }> = []

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => ({
      select: (_cols: string) => ({
        eq: (col: string, companyId: string) => ({
          gte: (countCol: string, minCount: number) => ({
            order: () => ({
              limit: async () => {
                queryLog.push({ table, companyId, minCount })
                return {
                  data: [
                    {
                      tool_name: "update_load_status",
                      entity_id: "load:abc",
                      outcome: "approved",
                      count: 3,
                    },
                  ],
                  error: null,
                }
              },
            }),
          }),
        }),
      }),
    }),
  }),
}))

import { getPreferenceContext } from "@/lib/ai/context"

describe("getPreferenceContext threshold query (ai_action_preferences schema)", () => {
  beforeEach(() => {
    queryLog.length = 0
  })

  it("queries company_id with count >= 2 against real column names", async () => {
    const block = await getPreferenceContext("company-uuid-1")
    expect(queryLog).toEqual([{ table: "ai_action_preferences", companyId: "company-uuid-1", minCount: 2 }])
    expect(block).toContain("update_load_status")
    expect(block).toContain("approved")
    expect(block).toContain("3 times")
  })
})
