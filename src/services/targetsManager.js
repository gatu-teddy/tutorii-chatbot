import { normalizeNumber } from "../utils/index.js"

function parseJsonTargets(rawJson) {
  const parsed = JSON.parse(rawJson)
  if (!Array.isArray(parsed)) {
    throw new Error("JSON must be an array of phone number strings")
  }

  const normalized = []

  for (let index = 0; index < parsed.length; index += 1) {
    const entry = parsed[index]
    if (typeof entry !== "string") {
      throw new Error(`Invalid entry at index ${index}: expected a string`)
    }

    const normalizedValue = normalizeNumber(entry)
    if (normalizedValue) {
      normalized.push(normalizedValue)
    }
  }

  if (!normalized.length) {
    throw new Error("No valid target numbers found in JSON")
  }

  return normalized
}

export function createTargetsManager({ targetsSet, repository }) {
  async function refreshTargetsSet() {
    const targets = await repository.listTargets()
    targetsSet.clear()

    for (const target of targets) {
      targetsSet.add(target)
    }

    return targets
  }

  async function listTargets() {
    return refreshTargetsSet()
  }

  async function addTarget(rawTarget) {
    const result = await repository.addTarget(rawTarget)
    await refreshTargetsSet()
    return result
  }

  async function deleteTarget(rawTarget) {
    const result = await repository.deleteTarget(rawTarget)
    await refreshTargetsSet()
    return result
  }

  async function importTargetsFromJson(rawJson) {
    if (!rawJson || !String(rawJson).trim()) {
      throw new Error("JSON payload is required")
    }

    const parsedTargets = parseJsonTargets(String(rawJson))
    const result = await repository.addManyTargets(parsedTargets)
    await refreshTargetsSet()
    return result
  }

  return {
    listTargets,
    addTarget,
    deleteTarget,
    importTargetsFromJson,
    refreshTargetsSet
  }
}
