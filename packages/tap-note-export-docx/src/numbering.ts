import { AlignmentType, LevelFormat } from "docx"
import type { INumberingOptions } from "docx"

const BULLET_SYMBOLS = ["•", "◦", "▪", "•", "◦", "▪", "•", "◦", "▪"]
const NUMBERING_LEVELS = 9

export const BULLET_LIST_REFERENCE = "tap-note-bullet-list"
export const NUMBERED_LIST_REFERENCE = "tap-note-numbered-list"

export function createNumberingConfig(): INumberingOptions {
  return {
    config: [
      {
        reference: BULLET_LIST_REFERENCE,
        levels: Array.from({ length: NUMBERING_LEVELS }, (_, i) => ({
          level: i,
          format: LevelFormat.BULLET,
          text: BULLET_SYMBOLS[i]!,
          alignment: AlignmentType.LEFT,
          style: {
            paragraph: {
              indent: { left: 720 * (i + 1), hanging: 360 },
            },
          },
        })),
      },
      {
        reference: NUMBERED_LIST_REFERENCE,
        levels: Array.from({ length: NUMBERING_LEVELS }, (_, i) => ({
          level: i,
          format: LevelFormat.DECIMAL,
          text: `%${i + 1}.`,
          alignment: AlignmentType.LEFT,
          style: {
            paragraph: {
              indent: { left: 720 * (i + 1), hanging: 360 },
            },
          },
        })),
      },
    ],
  }
}
