import type { ResourceResolver } from "@tap-note/export-core"

export function bufferToDataUri(buffer: Uint8Array, mimeType: string): string {
  let binary = ""
  for (let i = 0; i < buffer.length; i++) {
    binary += String.fromCharCode(buffer[i]!)
  }
  const base64 = btoa(binary)
  return `data:${mimeType};base64,${base64}`
}

export async function resolveImageToDataUri(
  url: string,
  resolver: ResourceResolver
): Promise<string> {
  const resolved = await resolver.resolve(url)
  return bufferToDataUri(resolved.buffer, resolved.mimeType)
}
