import { imageMeta } from "image-meta"

const DEFAULT_IMAGE_WIDTH = 500

export interface ImageDimensions {
  width: number
  height: number
}

export function detectImageDimensions(buffer: Uint8Array): ImageDimensions {
  try {
    const result = imageMeta(Buffer.from(buffer))
    if (result.width && result.height) {
      return { width: result.width, height: result.height }
    }
  } catch {
    // fall through to default
  }
  return { width: DEFAULT_IMAGE_WIDTH, height: DEFAULT_IMAGE_WIDTH }
}

export function scaleToFit(
  dimensions: ImageDimensions,
  maxWidth: number
): ImageDimensions {
  if (dimensions.width <= maxWidth) {
    return dimensions
  }
  const ratio = maxWidth / dimensions.width
  return {
    width: maxWidth,
    height: Math.round(dimensions.height * ratio),
  }
}
