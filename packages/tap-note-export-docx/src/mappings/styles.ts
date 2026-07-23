import type { IRunPropertiesOptions } from "docx"

export const docxStyleMapping = {
  bold: (value: boolean): IRunPropertiesOptions => ({
    bold: value,
  }),
  italic: (value: boolean): IRunPropertiesOptions => ({
    italics: value,
  }),
  underline: (value: boolean): IRunPropertiesOptions => ({
    underline: value ? {} : undefined,
  }),
  strike: (value: boolean): IRunPropertiesOptions => ({
    strike: value,
  }),
  textColor: (value: string): IRunPropertiesOptions => ({
    color: value.startsWith("#") ? value.slice(1) : value,
  }),
  backgroundColor: (value: string): IRunPropertiesOptions => ({
    shading: {
      type: "clear" as const,
      fill: value.startsWith("#") ? value.slice(1) : value,
    },
  }),
  code: (value: boolean): IRunPropertiesOptions =>
    value
      ? {
          font: "Consolas",
          shading: { type: "clear" as const, fill: "F0F0F0" },
        }
      : {},
} satisfies Record<string, (value: never) => IRunPropertiesOptions>
