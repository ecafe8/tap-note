import { Font } from "@react-pdf/renderer"
import type { FontConfig } from "@tap-note/export-core"
import { bufferToDataUri } from "./util/image"

export interface FontVariant {
  src: Uint8Array
  format?: "ttf" | "otf" | "woff" | "woff2"
  fontWeight?: number
  fontStyle?: "normal" | "italic"
}

export type FontBufferInput = Uint8Array | FontVariant[]

function getFontMimeType(format: FontVariant["format"] = "ttf"): string {
  return `font/${format}`
}

export interface FontRegistrationResult {
  warnings: Array<{ code: string; message: string }>
  registeredFamilies: Set<string>
}

export function registerFonts(
  fontConfig: FontConfig | undefined,
  fontBuffers: Record<string, FontBufferInput> | undefined
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
    const input = fontBuffers?.[family]
    if (input) {
      try {
        if (input instanceof Uint8Array) {
          const dataUri = bufferToDataUri(input, "font/ttf")
          Font.register({ family, src: dataUri })
        } else {
          Font.register({
            family,
            fonts: input.map((variant) => ({
              src: bufferToDataUri(variant.src, getFontMimeType(variant.format)),
              fontWeight: variant.fontWeight,
              fontStyle: variant.fontStyle,
            })),
          })
        }
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
