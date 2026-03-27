import type { ELDDvir } from "./eld"

export type LocalDvirReport = {
  id: string
  submittedAt: string
  synced: boolean
  payload: ELDDvir
}
