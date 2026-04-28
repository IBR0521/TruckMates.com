export type ParsedEdi204 = {
  transactionSet: "204"
  controlNumber: string | null
  tenderNumber: string | null
  shipmentReference: string | null
  shipperName: string | null
  shipperAddress: string | null
  shipperCity: string | null
  shipperState: string | null
  shipperZip: string | null
  consigneeName: string | null
  consigneeAddress: string | null
  consigneeCity: string | null
  consigneeState: string | null
  consigneeZip: string | null
  pickupDate: string | null
  deliveryDate: string | null
  weightLbs: number | null
}

function clean(v: string | undefined): string | null {
  const x = String(v || "").trim()
  return x.length ? x : null
}

export function parseX12(payload: string) {
  const normalized = String(payload || "").replace(/\r\n/g, "~").replace(/\n/g, "~")
  const segments = normalized
    .split("~")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.split("*"))

  const st = segments.find((seg) => seg[0] === "ST")
  const setId = st?.[1] || null
  if (!setId) return { transactionSet: null as string | null, data: null }

  if (setId !== "204") {
    return { transactionSet: setId, data: null }
  }

  const b2 = segments.find((seg) => seg[0] === "B2")
  const l11 = segments.find((seg) => seg[0] === "L11")
  const g62Pickup = segments.find((seg) => seg[0] === "G62" && seg[1] === "10")
  const g62Delivery = segments.find((seg) => seg[0] === "G62" && seg[1] === "17")
  const l3 = segments.find((seg) => seg[0] === "L3")

  const n1Indices = segments
    .map((seg, i) => ({ seg, i }))
    .filter((x) => x.seg[0] === "N1" && (x.seg[1] === "SH" || x.seg[1] === "CN"))

  const shipperRef = n1Indices.find((x) => x.seg[1] === "SH")
  const consigneeRef = n1Indices.find((x) => x.seg[1] === "CN")

  const shipperN3 = shipperRef ? segments[shipperRef.i + 1] : null
  const shipperN4 = shipperRef ? segments[shipperRef.i + 2] : null
  const consigneeN3 = consigneeRef ? segments[consigneeRef.i + 1] : null
  const consigneeN4 = consigneeRef ? segments[consigneeRef.i + 2] : null

  const data: ParsedEdi204 = {
    transactionSet: "204",
    controlNumber: clean(st?.[2]),
    tenderNumber: clean(b2?.[4] || b2?.[2]),
    shipmentReference: clean(l11?.[1]),
    shipperName: clean(shipperRef?.seg[2]),
    shipperAddress: clean(shipperN3?.[1]),
    shipperCity: clean(shipperN4?.[1]),
    shipperState: clean(shipperN4?.[2]),
    shipperZip: clean(shipperN4?.[3]),
    consigneeName: clean(consigneeRef?.seg[2]),
    consigneeAddress: clean(consigneeN3?.[1]),
    consigneeCity: clean(consigneeN4?.[1]),
    consigneeState: clean(consigneeN4?.[2]),
    consigneeZip: clean(consigneeN4?.[3]),
    pickupDate: clean(g62Pickup?.[2]),
    deliveryDate: clean(g62Delivery?.[2]),
    weightLbs: l3?.[1] ? Number(l3[1]) : null,
  }
  return { transactionSet: "204", data }
}

export function buildX12_990(params: {
  senderId: string
  receiverId: string
  controlNumber: string
  tenderNumber: string
  accepted: boolean
}) {
  const now = new Date()
  const date = now.toISOString().slice(0, 10).replace(/-/g, "")
  const time = now.toISOString().slice(11, 19).replace(/:/g, "")
  const ack = params.accepted ? "A" : "R"
  return [
    `ISA*00*          *00*          *ZZ*${params.senderId.padEnd(15)}*ZZ*${params.receiverId.padEnd(15)}*${date.slice(2)}*${time.slice(0,4)}*U*00401*${params.controlNumber.padStart(9,"0")}*0*P*>`,
    `GS*GF*${params.senderId}*${params.receiverId}*${date}*${time}*${params.controlNumber}*X*004010`,
    `ST*990*${params.controlNumber}`,
    `B1*${params.tenderNumber}*${ack}`,
    `SE*2*${params.controlNumber}`,
    `GE*1*${params.controlNumber}`,
    `IEA*1*${params.controlNumber.padStart(9,"0")}`,
  ].join("~")
}

export function buildX12_214(params: {
  senderId: string
  receiverId: string
  controlNumber: string
  shipmentReference: string
  statusCode: string
  city?: string
  state?: string
}) {
  const now = new Date()
  const date = now.toISOString().slice(0, 10).replace(/-/g, "")
  const time = now.toISOString().slice(11, 19).replace(/:/g, "")
  return [
    `ISA*00*          *00*          *ZZ*${params.senderId.padEnd(15)}*ZZ*${params.receiverId.padEnd(15)}*${date.slice(2)}*${time.slice(0,4)}*U*00401*${params.controlNumber.padStart(9,"0")}*0*P*>`,
    `GS*QM*${params.senderId}*${params.receiverId}*${date}*${time}*${params.controlNumber}*X*004010`,
    `ST*214*${params.controlNumber}`,
    `B10*${params.shipmentReference}`,
    `AT7*${params.statusCode}`,
    `MS1*${params.city || ""}*${params.state || ""}`,
    `SE*4*${params.controlNumber}`,
    `GE*1*${params.controlNumber}`,
    `IEA*1*${params.controlNumber.padStart(9,"0")}`,
  ].join("~")
}
