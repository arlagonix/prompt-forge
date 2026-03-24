import type { FrontMatterResult, Parameter } from "./types"

function parseScalarValue(raw: unknown): unknown {
  const value = String(raw ?? "").trim()
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1)
  }
  if (/^(true|false)$/i.test(value)) {
    return value.toLowerCase() === "true"
  }
  if (/^(null|~)$/i.test(value)) {
    return null
  }
  if (/^-?\d+(\.\d+)?$/.test(value)) {
    return Number(value)
  }
  return value
}

function stringifyMetadataValue(value: unknown): string {
  if (Array.isArray(value)) return value.join(", ")
  if (value == null) return ""
  if (typeof value === "object") return JSON.stringify(value)
  return String(value)
}

export function parseFrontMatter(content: string): FrontMatterResult {
  if (typeof content !== "string") {
    return {
      metadata: {},
      body: "",
      rawFrontMatter: "",
      hasFrontMatter: false,
    }
  }

  const normalized = content.replace(/\r\n/g, "\n")
  const match = normalized.match(/^(\uFEFF)?---\n([\s\S]*?)\n---(?:\n|$)/)

  if (!match) {
    return {
      metadata: {},
      body: content,
      rawFrontMatter: "",
      hasFrontMatter: false,
    }
  }

  const rawFrontMatter = match[0]
  const rawBody = normalized.slice(rawFrontMatter.length)
  const metadataBlock = match[2]
  const metadata: Record<string, unknown> = {}
  const lines = metadataBlock.split("\n")

  let currentKey: string | null = null

  for (const line of lines) {
    if (!line.trim()) continue

    const keyMatch = line.match(/^([A-Za-z0-9_.-]+)\s*:\s*(.*)$/)
    if (keyMatch) {
      const key = keyMatch[1]
      const rawValue = keyMatch[2]

      if (rawValue === "") {
        metadata[key] = []
      } else {
        metadata[key] = parseScalarValue(rawValue)
      }
      currentKey = key
      continue
    }

    const listMatch = line.match(/^\s*-\s+(.*)$/)
    if (listMatch && currentKey) {
      if (!Array.isArray(metadata[currentKey])) {
        metadata[currentKey] = metadata[currentKey] == null ? [] : [metadata[currentKey]]
      }
      ;(metadata[currentKey] as unknown[]).push(parseScalarValue(listMatch[1]))
      continue
    }

    const continuationMatch = line.match(/^\s+(.+)$/)
    if (continuationMatch && currentKey) {
      const continuation = continuationMatch[1]
      if (Array.isArray(metadata[currentKey])) {
        (metadata[currentKey] as unknown[]).push(parseScalarValue(continuation))
      } else {
        const previous = stringifyMetadataValue(metadata[currentKey])
        metadata[currentKey] = previous ? previous + "\n" + continuation : continuation
      }
    }
  }

  return {
    metadata,
    body: rawBody.replace(/^\n+/, ""),
    rawFrontMatter,
    hasFrontMatter: true,
  }
}

function formatParamName(p: string): string {
  return p.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

function parsePlaceholderInner(inner: string): Parameter | null {
  const s = String(inner)
  let defaultIdx = -1
  let pos = 0
  
  while (pos < s.length) {
    const idx = s.indexOf("default=", pos)
    if (idx === -1) break
    if (idx === 0 || s.substring(idx - 3, idx) === " | ") {
      defaultIdx = idx
      break
    }
    pos = idx + 1
  }

  let beforeDefault = s
  let defaultValue: string | null = null
  
  if (defaultIdx !== -1) {
    beforeDefault = s
      .slice(0, defaultIdx)
      .trimEnd()
      .replace(/ \|$/, "")
      .trimEnd()
    const ds = defaultIdx + "default=".length
    const de = s.indexOf(" | ", ds)
    defaultValue = de === -1 ? s.slice(ds) : s.slice(ds, de)
  }

  const parts = beforeDefault
    .split("|")
    .map((p) => p.trim())
    .filter(Boolean)
    
  if (!parts.length) return null
  const name = parts[0]
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) return null

  let type: Parameter["type"] = "textarea"
  let label: string | null = null
  let height: number | null = null
  const values: string[] = []

  for (let i = 1; i < parts.length; i++) {
    const t = parts[i]
    const mType = t.match(/^type\s*=\s*(textarea|text|number|checkbox|select|radio)\s*$/)
    if (mType) {
      type = mType[1] as Parameter["type"]
      continue
    }
    const mLabel = t.match(/^label\s*=\s*(.+)$/)
    if (mLabel) {
      label = mLabel[1].trim()
      continue
    }
    const mH = t.match(/^height\s*=\s*(\d+)\s*$/)
    if (mH) {
      height = parseInt(mH[1])
      continue
    }
    const mV = t.match(/^value\s*=\s*(.+)$/)
    if (mV) {
      values.push(mV[1].trim())
    }
  }

  if (defaultIdx !== -1) {
    const ds = defaultIdx + "default=".length
    const de = s.indexOf(" | ", ds)
    if (de !== -1) {
      for (const t of s
        .slice(de + 3)
        .split("|")
        .map((p) => p.trim())
        .filter(Boolean)) {
        const mH = t.match(/^height\s*=\s*(\d+)\s*$/)
        if (mH) {
          height = parseInt(mH[1])
          continue
        }
        const mV = t.match(/^value\s*=\s*(.+)$/)
        if (mV) {
          values.push(mV[1].trim())
        }
      }
    }
  }

  if (type === "checkbox" && defaultValue == null) defaultValue = "false"
  if ((type === "select" || type === "radio") && defaultValue == null && values.length) {
    defaultValue = values[0]
  }

  return {
    name,
    type,
    label: label || formatParamName(name),
    defaultValue,
    height,
    values,
  }
}

export function extractParameters(content: string | null): Parameter[] {
  if (typeof content !== "string") return []
  const out: Parameter[] = []
  const seen = new Set<string>()
  let i = 0
  
  while (i < content.length) {
    const s = content.indexOf("{{", i)
    if (s === -1) break
    const e = content.indexOf("}}", s + 2)
    if (e === -1) break
    const p = parsePlaceholderInner(content.slice(s + 2, e))
    if (p?.name && !seen.has(p.name)) {
      out.push(p)
      seen.add(p.name)
    }
    i = e + 2
  }
  return out
}

export function buildPrompt(
  bodyContent: string | null,
  content: string | null,
  params: Parameter[],
  formValues: Map<string, string>
): string | null {
  const tmpl = bodyContent ?? content ?? ""
  let out = ""
  let i = 0
  
  while (i < tmpl.length) {
    const s = tmpl.indexOf("{{", i)
    if (s === -1) {
      out += tmpl.slice(i)
      break
    }
    out += tmpl.slice(i, s)
    const e = tmpl.indexOf("}}", s + 2)
    if (e === -1) {
      out += tmpl.slice(s)
      break
    }
    const p = parsePlaceholderInner(tmpl.slice(s + 2, e))
    out += p?.name && formValues.has(p.name)
      ? formValues.get(p.name) || ""
      : tmpl.slice(s, e + 2)
    i = e + 2
  }
  
  return out.replace(/\n\s*\n\s*\n/g, "\n\n").trim()
}
