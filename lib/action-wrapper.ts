"use server"

import { checkViewPermission, checkCreatePermission, checkEditPermission, checkDeletePermission, type FeatureCategory } from "./server-permissions"

/**
 * Wrapper to check permissions before executing an action
 */
export async function withPermissionCheck<T>(
  feature: FeatureCategory,
  permissionType: "view" | "create" | "edit" | "delete",
  action: () => Promise<T>
): Promise<{ data: T | null; error: string | null }> {
  let permissionCheck
  switch (permissionType) {
    case "view":
      permissionCheck = await checkViewPermission(feature)
      break
    case "create":
      permissionCheck = await checkCreatePermission(feature)
      break
    case "edit":
      permissionCheck = await checkEditPermission(feature)
      break
    case "delete":
      permissionCheck = await checkDeletePermission(feature)
      break
  }

  if (!permissionCheck.allowed) {
    return {
      data: null,
      error: permissionCheck.error || "Permission denied",
    }
  }

  try {
    const result = await action()
    return { data: result, error: null }
  } catch (error: any) {
    return {
      data: null,
      error: error?.message || "Action failed",
    }
  }
}






