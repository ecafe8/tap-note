/* eslint-disable @typescript-eslint/no-explicit-any */
import { ExternalHyperlink } from "docx"
import type { ParagraphChild } from "docx"
import type { Exporter } from "@blocknote/core"

export function createInlineContentMapping() {
  return {
    text: (
      inlineContent: { type: "text"; text: string; styles: Record<string, unknown> },
      exporter: Exporter<any, any, any, any, any, any, any>
    ): ParagraphChild => {
      return exporter.transformStyledText(inlineContent as any)
    },
    link: (
      inlineContent: {
        type: "link"
        href: string
        content: Array<{ type: "text"; text: string; styles: Record<string, unknown> }>
      },
      exporter: Exporter<any, any, any, any, any, any, any>
    ): ParagraphChild => {
      const children = inlineContent.content.map((ic) =>
        exporter.transformStyledText(ic as any)
      )
      return new ExternalHyperlink({
        link: inlineContent.href,
        children,
      }) as unknown as ParagraphChild
    },
  }
}
