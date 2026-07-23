export interface FontFamily {
  ascii?: string
  hAnsi?: string
  eastAsia?: string
  cs?: string
  size?: number
}

export interface FontConfig {
  default?: FontFamily
  overrides?: Record<string, FontFamily>
}
