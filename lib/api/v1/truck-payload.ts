/** Map public API field names to trucks table columns. */
export function mapTruckWritePayload<T extends Record<string, unknown>>(data: T) {
  const { plate_number, driver_id, ...rest } = data
  return {
    ...rest,
    ...(plate_number !== undefined ? { license_plate: plate_number } : {}),
    ...(driver_id !== undefined ? { current_driver_id: driver_id } : {}),
  }
}

export const TRUCK_SELECT_FIELDS =
  "id, truck_number, make, model, year, vin, license_plate, status, current_driver_id, created_at, updated_at" as const

export const TRUCK_SELECT_FIELDS_BRIEF =
  "id, truck_number, make, model, year, vin, license_plate, status, current_driver_id, created_at" as const
