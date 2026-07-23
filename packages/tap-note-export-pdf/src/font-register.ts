import { Font } from "@react-pdf/renderer"
import type { FontConfig } from "@tap-note/export-core"
import { bufferToDataUri } from "./util/image"

export interface FontRegistrationResult {
  warnings: Array<{ code: string; message: string }>
  registeredFamilies: Set<string>
}

export function registerFonts(
  fontConfig: FontConfig | undefined,
  fontBuffers: Record<string, Uint8Array> | undefined
): FontRegistrationResult {
  const warnings: FontRegistrationResult["warnings"] = []
  const registeredFamilies = new Set<string>()

  if (!fontConfig?.default && !fontBuffers) {
    return { warnings, registeredFamilies }
  }

  const familiesToRegister = new Set<string>()

  if (fontConfig?.default) {
    if (fontConfig.default.ascii) familiesToRegister.add(fontConfig.default.ascii)
    if (fontConfig.default.eastAsia) familiesToRegister.add(fontConfig.default.eastAsia)
  }

  for (const family of familiesToRegister) {
    const buffer = fontBuffers?.[family]
    if (buffer) {
      try {
        const dataUri = bufferToDataUri(buffer, "font/ttf")
        Font.register({ family, src: dataUri })
        registeredFamilies.add(family)
      } catch {
        warnings.push({
          code: "FONT_MISSING",
          message: `Failed to register font family "${family}".`,
        })
      }
    } else {
      warnings.push({
        code: "FONT_MISSING",
        message: `Font buffer not provided for family "${family}". CJK characters may not render correctly.`,
      })
    }
  }

  return { warnings, registeredFamilies }
}

export function getFontFamily(
  fontConfig: FontConfig | undefined,
  registeredFamilies: Set<string>
): string {
  const desired = fontConfig?.default?.ascii
  if (desired && registeredFamilies.has(desired)) {
    return desired
  }
  return "Helvetica"
}

export function getEastAsiaFontFamily(fontConfig: FontConfig | undefined): string | undefined {
  return fontConfig?.default?.eastAsia
}
