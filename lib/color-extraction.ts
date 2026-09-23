export interface ExtractedColor {
  rgb: [number, number, number]
  hex: string
  hsl: [number, number, number]
  cssRgb: string
  cssHsl: string
  isLight: boolean
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255
  g /= 255
  b /= 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)

    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0)
        break
      case g:
        h = (b - r) / d + 2
        break
      case b:
        h = (r - g) / d + 4
        break
    }
    h /= 6
  }

  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)]
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${  [r, g, b].map(x => {
    const hex = x.toString(16)
    return hex.length === 1 ? `0${  hex}` : hex
  }).join("")}`
}

function isLightColor(r: number, g: number, b: number): boolean {
  // Rec. 601 luma (perceived brightness), not WCAG relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.5
}

/**
 * Picks the logo's dominant colour, favouring saturated mid-lightness pixels and
 * penalising the edge (background) colour, greys, near-white and near-black.
 * Falls back to blue (#3b82f6) when no opaque pixel qualifies.
 */
export async function extractDominantColor(imageUrl: string): Promise<ExtractedColor> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas")
        const ctx = canvas.getContext("2d")
        
        if (!ctx) {
          throw new Error("Could not get canvas context")
        }

        // Downscaled for performance
        const size = 150
        canvas.width = size
        canvas.height = size
        
        ctx.drawImage(img, 0, 0, size, size)
        
        const imageData = ctx.getImageData(0, 0, size, size)
        const data = imageData.data
        
        const colorMap = new Map<string, { count: number, weight: number }>()
        
        // First pass: the most common colour in a 10px border is treated as the background
        const edgeColors = new Map<string, number>()
        const edgeSize = 10
        
        for (let x = 0; x < size; x++) {
          for (let y = 0; y < size; y++) {
            if (x < edgeSize || x >= size - edgeSize || y < edgeSize || y >= size - edgeSize) {
              const i = (y * size + x) * 4
              const r = data[i]
              const g = data[i + 1]
              const b = data[i + 2]
              const a = data[i + 3]
              
              if (a > 128) {
                const colorKey = `${Math.round(r / 20) * 20},${Math.round(g / 20) * 20},${Math.round(b / 20) * 20}`
                edgeColors.set(colorKey, (edgeColors.get(colorKey) || 0) + 1)
              }
            }
          }
        }
        
        let backgroundColorKey = ""
        let maxEdgeCount = 0
        for (const [colorKey, count] of edgeColors.entries()) {
          if (count > maxEdgeCount) {
            maxEdgeCount = count
            backgroundColorKey = colorKey
          }
        }
        
        // Every 4th pixel (4 bytes per pixel)
        for (let i = 0; i < data.length; i += 16) {
          const r = data[i]
          const g = data[i + 1]
          const b = data[i + 2]
          const a = data[i + 3]
          
          if (a < 128) continue
          
          // Bucket to steps of 10 to reduce noise
          const roundedR = Math.round(r / 10) * 10
          const roundedG = Math.round(g / 10) * 10
          const roundedB = Math.round(b / 10) * 10
          const colorKey = `${roundedR},${roundedG},${roundedB}`
          
          const saturation = rgbToHsl(r, g, b)[1]
          const lightness = rgbToHsl(r, g, b)[2]
          
          if (lightness > 90 && saturation < 10) continue
          
          if (lightness < 5) continue
          
          const backgroundMatch = backgroundColorKey && 
            Math.abs(roundedR - Number.parseInt(backgroundColorKey.split(',')[0])) < 30 &&
            Math.abs(roundedG - Number.parseInt(backgroundColorKey.split(',')[1])) < 30 &&
            Math.abs(roundedB - Number.parseInt(backgroundColorKey.split(',')[2])) < 30
          
          let weight = 1
          
          // Favour vibrant colours: low saturation is penalised, >=50% gets a quadratic boost
          if (saturation < 20) {
            weight *= 0.1
          } else if (saturation < 30) {
            weight *= 0.3
          } else if (saturation >= 50) {
            weight *= Math.pow(saturation / 50, 2)
          } else {
            weight *= saturation / 30
          }
          
          if (lightness >= 20 && lightness <= 80) {
            weight *= 2
          }
          
          if (backgroundMatch) {
            weight *= 0.05
          }
          
          const grayThreshold = 20
          const isGrayscale = Math.abs(r - g) < grayThreshold && 
                             Math.abs(g - b) < grayThreshold && 
                             Math.abs(r - b) < grayThreshold
          
          if (isGrayscale) {
            // Light greys are nearly eliminated; dark greys are penalised less
            if (lightness > 30 || saturation < 5) {
              weight *= 0.05
            } else {
              weight *= 0.2
            }
          }
          
          if ((r > 240 && g > 240 && b > 240) || // white-ish
              (r < 30 && g < 30 && b < 30)) {   // black-ish
            weight *= 0.1
          }
          
          const existing = colorMap.get(colorKey) || { count: 0, weight: 0 }
          colorMap.set(colorKey, {
            count: existing.count + 1,
            weight: existing.weight + weight
          })
        }
        
        if (colorMap.size === 0) {
          const fallbackColor: ExtractedColor = {
            rgb: [59, 130, 246],
            hex: "#3b82f6",
            hsl: [217, 91, 60],
            cssRgb: "rgb(59, 130, 246)",
            cssHsl: "hsl(217, 91%, 60%)",
            isLight: false
          }
          resolve(fallbackColor)
          return
        }
        
        let dominantColor = ""
        let maxScore = 0
        
        for (const [color, data] of colorMap.entries()) {
          const score = data.count * data.weight
          if (score > maxScore) {
            maxScore = score
            dominantColor = color
          }
        }
        
        const [r, g, b] = dominantColor.split(",").map(Number)
        const hsl = rgbToHsl(r, g, b)
        const hex = rgbToHex(r, g, b)
        
        const extractedColor: ExtractedColor = {
          rgb: [r, g, b],
          hex,
          hsl,
          cssRgb: `rgb(${r}, ${g}, ${b})`,
          cssHsl: `hsl(${hsl[0]}, ${hsl[1]}%, ${hsl[2]}%)`,
          isLight: isLightColor(r, g, b)
        }
        
        resolve(extractedColor)
      } catch (error) {
        reject(error)
      }
    }
    
    img.onerror = () => {
      reject(new Error("Failed to load image"))
    }
    
    img.src = imageUrl
  })
}

/**
 * Builds the `--primary-*` CSS variables from the logo colour.
 *
 * Every `--primary-*` value is a bare, space-separated HSL triple (`217 91% 55%`), never the comma
 * form: Tailwind wraps it as `hsl(var(--primary-600))` and `hsl(var(--primary-600) / 0.5)`, where
 * commas are invalid.
 *
 * Lightness guarantees relied on by the dark-mode rules: 50 = 96%, 100 = 94%, 300 >= 80%,
 * 400 >= 75%, 600 <= 50%, 700 <= 40%, 800 <= 30%, 900 <= 22%, 950 = 12%.
 */
export function generateColorTheme(color: ExtractedColor) {
  const [h, s, l] = color.hsl
  
  const baseSaturation = Math.min(s, 85)
  
  const backgroundLightness50 = 96
  const backgroundLightness100 = 94
  
  return {
    "--primary": `${h} ${baseSaturation}% ${l}%`,
    "--primary-rgb": color.rgb.join(", "),
    "--primary-h": h.toString(),
    "--primary-s": `${baseSaturation}%`,
    "--primary-l": `${l}%`,
    
    // Light tints: saturation scaled down and capped so backgrounds stay subtle
    "--primary-50": `${h} ${Math.min(s * 0.5, 50)}% ${backgroundLightness50}%`,
    "--primary-100": `${h} ${Math.min(s * 0.6, 55)}% ${backgroundLightness100}%`,
    "--primary-200": `${h} ${Math.min(s * 0.7, 60)}% ${Math.max(l + 25, 85)}%`,
    "--primary-300": `${h} ${Math.min(s * 0.8, 65)}% ${Math.max(l + 15, 80)}%`,
    "--primary-400": `${h} ${Math.min(s * 0.9, 70)}% ${Math.max(l + 10, 75)}%`,
    
    // 600 and darker are clamped dark enough for white text
    "--primary-500": `${h} ${baseSaturation}% ${l}%`,
    "--primary-600": `${h} ${Math.min(s, 85)}% ${Math.min(Math.max(l - 10, 25), 50)}%`,
    "--primary-700": `${h} ${Math.min(s, 90)}% ${Math.min(Math.max(l - 15, 20), 40)}%`,

    // 800/900 double as dark-mode borders and tinted surfaces under light text
    // (dark:border-primary-800, dark:bg-primary-900/50).
    "--primary-800": `${h} ${Math.min(s, 95)}% ${Math.min(Math.max(l - 20, 15), 30)}%`,
    "--primary-900": `${h} ${s}% ${Math.min(Math.max(l - 30, 10), 22)}%`,

    // Dark-mode tinted surface (dark:bg-primary-950): logo hue, desaturated, so it
    // reads as a near-neutral deep surface.
    "--primary-950": `${h} ${Math.min(s * 0.55, 45)}% 12%`,
  }
}