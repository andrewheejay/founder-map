/** WCAG 2.x relative luminance and contrast ratio over sRGB hex colors; `mix` matches color-mix(in srgb). */
export const hex = (h: string): number[] => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))

export const luminance = ([r, g, b]: number[]): number => {
  const lin = (v: number) => (v / 255 <= 0.03928 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4)
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

export const contrast = (a: number[], b: number[]): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

export const mix = (a: number[], b: number[], t: number): number[] => a.map((v, i) => v * t + b[i] * (1 - t))
