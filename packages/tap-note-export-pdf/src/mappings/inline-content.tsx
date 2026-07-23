/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react"
import { Text, Link } from "@react-pdf/renderer"
import { mergeStyles } from "./styles"

interface InlineText {
  type: "text"
  text: string
  styles: Record<string, unknown>
}

interface InlineLink {
  type: "link"
  href: string
  content: InlineText[]
}

type InlineContent = InlineText | InlineLink

export function renderInlineContent(
  content: InlineContent[],
  keyPrefix = "ic"
): React.ReactElement[] {
  return content.map((ic, i) => {
    const key = `${keyPrefix}-${i}`
    if (ic.type === "link") {
      return React.createElement(
        Link,
        { key, src: ic.href },
        ...ic.content.map((child, j) =>
          React.createElement(
            Text,
            { key: `${key}-t-${j}`, style: mergeStyles(child.styles) as any },
            child.text
          )
        )
      )
    }
    return React.createElement(
      Text,
      { key, style: mergeStyles(ic.styles) as any },
      ic.text
    )
  })
}
