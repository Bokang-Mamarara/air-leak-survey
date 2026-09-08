/**
 * A per-device tag for LeakRecord.loggedBy. There is no login (CLAUDE.md,
 * out of scope) and no way to know who is holding the phone, so this
 * identifies the device, not the person — generated once with
 * crypto.randomUUID() and cached in localStorage, the same client-owned-
 * identity principle as the record ids themselves. See DECISIONS.md: mapping
 * devices to crews is a real-deployment requirement, not something this tool
 * can infer.
 */

const DEVICE_ID_STORAGE_KEY = 'air-leak-survey.deviceId'

export function getDeviceId(): string {
  const existing = localStorage.getItem(DEVICE_ID_STORAGE_KEY)
  if (existing) {
    return existing
  }

  const generated = crypto.randomUUID()
  localStorage.setItem(DEVICE_ID_STORAGE_KEY, generated)
  return generated
}
