export interface ResolvedResource {
  buffer: Uint8Array
  mimeType: string
  fileName?: string
}

export interface ResourceResolver {
  resolve(url: string): Promise<ResolvedResource>
}

export function createNoopResolver(): ResourceResolver {
  return {
    resolve(url: string): Promise<ResolvedResource> {
      return Promise.reject(
        new Error(`Noop resolver cannot resolve resource: ${url}`)
      )
    },
  }
}
