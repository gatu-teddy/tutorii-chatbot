import fs from "fs"
import { normalizeNumber } from "../utils/index.js"

function toStoredTarget(number) {
  return `whatsapp:${number}`
}

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

export function createTargetsManager({ targetsSet, targetsFile }) {
  function listTargets() {
    return [...targetsSet].sort((a, b) => a.localeCompare(b))
  }

  function persist() {
    const stored = listTargets().map(toStoredTarget)
    fs.writeFileSync(targetsFile, `${JSON.stringify(stored, null, 2)}\n`, "utf8")
  }

  function addTarget(rawTarget) {
    const normalized = normalizeNumber(rawTarget)
    if (!normalized) {
      throw new Error("Target number is required")
    }

    const wasPresent = targetsSet.has(normalized)
    targetsSet.add(normalized)
    persist()

    return {
      target: normalized,
      added: !wasPresent
    }
  }

  function deleteTarget(rawTarget) {
    const normalized = normalizeNumber(rawTarget)
    if (!normalized) {
      throw new Error("Target number is required")
    }

    const existed = targetsSet.delete(normalized)
    persist()

    return {
      target: normalized,
      deleted: existed
    }
  }

  function importTargetsFromJson(rawJson) {
    if (!rawJson || !String(rawJson).trim()) {
      throw new Error("JSON payload is required")
    }

    const parsedTargets = parseJsonTargets(String(rawJson))
    let addedCount = 0

    for (const target of parsedTargets) {
      if (!targetsSet.has(target)) {
        targetsSet.add(target)
        addedCount += 1
      }
    }

    persist()

    return {
      importedCount: parsedTargets.length,
      addedCount,
      duplicateCount: parsedTargets.length - addedCount
    }
  }

  return {
    listTargets,
    addTarget,
    deleteTarget,
    importTargetsFromJson
  }
}
