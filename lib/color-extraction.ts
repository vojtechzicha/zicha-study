/**
 * Extracts the dominant color from an image using HTML5 Canvas
 * Returns a color object with RGB values and CSS color strings
 */

export interface ExtractedColor {
  rgb: [number, number, number]
  hex: string
  hsl: [number, number, number]
  cssRgb: string
  cssHsl: string
  isLight: boolean
}

/**
 * Converts RGB to HSL
 */
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

/**
 * Converts RGB to Hex
 */
function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map(x => {
    const hex = x.toString(16)
    return hex.length === 1 ? "0" + hex : hex
  }).join("")
}

/**
 * Determines if a color is light or dark
 */
function isLightColor(r: number, g: number, b: number): boolean {
  // Using relative luminance formula
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.5
}

/**
 * Extracts the dominant color from an image URL
 */
export async function extractDominantColor(imageUrl: string): Promise<ExtractedColor> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    
    img.onload = () => {
      try {
        // Create canvas and draw image
        const canvas = document.createElement("canvas")
        const ctx = canvas.getContext("2d")
        
        if (!ctx) {
          throw new Error("Could not get canvas context")
        }

        // Set canvas size (smaller for performance)
        const size = 150
        canvas.width = size
        canvas.height = size
        
        // Draw image scaled to canvas
        ctx.drawImage(img, 0, 0, size, size)
        
        // Get image data
        const imageData = ctx.getImageData(0, 0, size, size)
        const data = imageData.data
        
        // Color frequency map with weighting
        const colorMap = new Map<string, { count: number, weight: number }>()
        
        // First pass: identify likely background colors
        const edgeColors = new Map<string, number>()
        const edgeSize = 10 // pixels from edge to consider as likely background
        
        // Sample edge pixels to identify background colors
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
        
        // Find the most common edge color (likely background)
        let backgroundColorKey = ""
        let maxEdgeCount = 0
        for (const [colorKey, count] of edgeColors.entries()) {
          if (count > maxEdgeCount) {
            maxEdgeCount = count
            backgroundColorKey = colorKey
          }
        }
        
        // Sample every 4th pixel for performance
        for (let i = 0; i < data.length; i += 16) {
          const r = data[i]
          const g = data[i + 1]
          const b = data[i + 2]
          const a = data[i + 3]
          
          // Skip transparent/near-transparent pixels
          if (a < 128) continue
          
          // Create color key (rounded to reduce noise)
          const roundedR = Math.round(r / 10) * 10
          const roundedG = Math.round(g / 10) * 10
          const roundedB = Math.round(b / 10) * 10
          const colorKey = `${roundedR},${roundedG},${roundedB}`
          
          // Calculate saturation to prioritize vibrant colors
          const saturation = rgbToHsl(r, g, b)[1]
          const lightness = rgbToHsl(r, g, b)[2]
          
          // Skip very light colors (white/near-white backgrounds)
          if (lightness > 90 && saturation < 10) continue
          
          // Skip very dark colors (pure black)
          if (lightness < 5) continue
          
          // Check if this is similar to the background color
          const backgroundMatch = backgroundColorKey && 
            Math.abs(roundedR - Number.parseInt(backgroundColorKey.split(',')[0])) < 30 &&
            Math.abs(roundedG - Number.parseInt(backgroundColorKey.split(',')[1])) < 30 &&
            Math.abs(roundedB - Number.parseInt(backgroundColorKey.split(',')[2])) < 30
          
          // Calculate weight based on color characteristics
          let weight = 1
          
          // Boost saturated colors (more vibrant = higher weight)
          weight *= 1 + (saturation / 100)
          
          // Boost colors that aren't too light or too dark
          if (lightness >= 20 && lightness <= 80) {
            weight *= 2
          }
          
          // Reduce weight for background-like colors
          if (backgroundMatch) {
            weight *= 0.1
          }
          
          // Reduce weight for very common "background" colors
          if ((r > 240 && g > 240 && b > 240) || // white-ish
              (r < 30 && g < 30 && b < 30) ||   // black-ish
              (Math.abs(r - g) < 10 && Math.abs(g - b) < 10 && Math.abs(r - b) < 10)) { // grayscale
            weight *= 0.2
          }
          
          const existing = colorMap.get(colorKey) || { count: 0, weight: 0 }
          colorMap.set(colorKey, {
            count: existing.count + 1,
            weight: existing.weight + weight
          })
        }
        
        if (colorMap.size === 0) {
          // Fallback to blue if no colors found
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
        
        // Find the color with highest weighted score
        let dominantColor = ""
        let maxScore = 0
        
        for (const [color, data] of colorMap.entries()) {
          // Combine frequency and weight for final score
          const score = data.count * data.weight
          if (score > maxScore) {
            maxScore = score
            dominantColor = color
          }
        }
        
        // Parse the dominant color
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
 * Generates CSS custom properties for theming based on extracted color
 * Ensures light, subtle backgrounds while preserving the original color for accents
 */
export function generateColorTheme(color: ExtractedColor) {
  const [h, s, l] = color.hsl
  
  // For very saturated or dark colors, reduce saturation for lighter shades
  // This ensures backgrounds remain subtle
  const lightSaturation = Math.min(s, 60) // Cap saturation for light shades
  const baseSaturation = Math.min(s, 80)  // Slightly reduce base saturation
  
  // Ensure we have proper light values for backgrounds
  const backgroundLightness50 = Math.max(92, 95)  // Very light background
  const backgroundLightness100 = Math.max(88, 92) // Light background
  
  return {
    "--primary": `hsl(${h}, ${baseSaturation}%, ${l}%)`,
    "--primary-rgb": color.rgb.join(", "),
    "--primary-h": h.toString(),
    "--primary-s": `${baseSaturation}%`,
    "--primary-l": `${l}%`,
    
    // Light backgrounds with reduced saturation
    "--primary-50": `hsl(${h}, ${Math.min(lightSaturation, 30)}%, ${backgroundLightness50}%)`,
    "--primary-100": `hsl(${h}, ${Math.min(lightSaturation, 35)}%, ${backgroundLightness100}%)`,
    "--primary-200": `hsl(${h}, ${Math.min(lightSaturation, 40)}%, ${Math.max(l + 25, 85)}%)`,
    "--primary-300": `hsl(${h}, ${Math.min(baseSaturation, 50)}%, ${Math.max(l + 15, 80)}%)`,
    "--primary-400": `hsl(${h}, ${Math.min(baseSaturation, 60)}%, ${Math.max(l + 10, 75)}%)`,
    
    // Original and darker shades preserve more saturation
    "--primary-500": `hsl(${h}, ${baseSaturation}%, ${l}%)`,
    "--primary-600": `hsl(${h}, ${Math.min(s, 85)}%, ${Math.max(l - 8, 25)}%)`,
    "--primary-700": `hsl(${h}, ${Math.min(s, 90)}%, ${Math.max(l - 15, 20)}%)`,
    "--primary-800": `hsl(${h}, ${Math.min(s, 95)}%, ${Math.max(l - 22, 15)}%)`,
    "--primary-900": `hsl(${h}, ${s}%, ${Math.max(l - 30, 10)}%)`,
  }
}