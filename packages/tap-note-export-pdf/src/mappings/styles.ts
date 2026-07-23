type PdfStyle = Record<string, string | number | undefined>

export function mapStyle(key: string, value: unknown): PdfStyle {
  switch (key) {
    case "bold":
      return value ? { fontWeight: "bold" } : {}
    case "italic":
      return value ? { fontStyle: "italic" } : {}
    case "underline":
      return value ? { textDecoration: "underline" } : {}
    case "strike":
      return value ? { textDecoration: "line-through" } : {}
    case "textColor":
      return typeof value === "string" ? { color: value } : {}
    case "backgroundColor":
      return typeof value === "string" ? { backgroundColor: value } : {}
    case "code":
      return value ? { fontFamily: "Courier", backgroundColor: "#F0F0F0" } : {}
    default:
      return {}
  }
}

export function mergeStyles(styles: Record<string, unknown>): PdfStyle {
  const merged: PdfStyle = {}
  for (const [key, value] of Object.entries(styles)) {
    Object.assign(merged, mapStyle(key, value))
  }
  return merged
}
