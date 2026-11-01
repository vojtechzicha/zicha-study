// The importer locks a synced term when the student registers and marks the lock as its own
// (external.auto_locked), so it can release it on deregistration. Once the user changes the lock
// by hand (UI toggle, editor, MCP), the lock is the user's: the flag is cleared.

type Doc = Record<string, any>

/** Extra $set fields for a user's update of a term; {} when the lock doesn't change. */
export function userLockOwnershipPatch(current: Doc | null, data: Doc): Doc {
  if (!current?.external || !("locked" in data) || "external" in data) return {}
  if (!!data.locked === !!current.locked || !current.external.auto_locked) return {}
  return { "external.auto_locked": false }
}
