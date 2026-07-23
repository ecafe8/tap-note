import type { FontConfig } from "@tap-note/export-core"

export function buildDefaultStyles(fontConfig?: FontConfig) {
  if (!fontConfig?.default) {
    return undefined
  }

  const { ascii, hAnsi, eastAsia, cs, size } = fontConfig.default

  const font: Record<string, string> = {}
  if (ascii) font.ascii = ascii
  if (hAnsi) font.hAnsi = hAnsi
  if (eastAsia) font.eastAsia = eastAsia
  if (cs) font.cs = cs

  return {
    default: {
      document: {
        run: {
          ...(Object.keys(font).length > 0 ? { font } : {}),
          ...(size != null ? { size: size * 2 } : {}),
        },
      },
    },
  }
}

export function getFontForBlock(
  blockType: string,
  fontConfig?: FontConfig
): Record<string, string> | undefined {
  const override = fontConfig?.overrides?.[blockType]
  if (!override) return undefined

  const font: Record<string, string> = {}
  if (override.ascii) font.ascii = override.ascii
  if (override.hAnsi) font.hAnsi = override.hAnsi
  if (override.eastAsia) font.eastAsia = override.eastAsia
  if (override.cs) font.cs = override.cs

  return Object.keys(font).length > 0 ? font : undefined
}
