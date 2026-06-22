"use client"

import { useRef, useState, useCallback } from "react"
import { getStroke } from "perfect-freehand"
import type { DoodleScene, DoodleStroke } from "@/lib/types/markdown-notes"
import { Button } from "@/components/ui/button"
import { Pencil, Eraser, Undo2, Trash2 } from "lucide-react"

const PEN_COLORS = ["#1f2937", "#dc2626", "#2563eb", "#16a34a", "#d97706"]
const PEN_SIZES = [2, 4, 8]

// Convert a perfect-freehand outline into an SVG path string.
function outlineToPath(points: number[][]): string {
  if (points.length === 0) return ""
  const d = points.reduce(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length]
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2)
      return acc
    },
    ["M", points[0][0], points[0][1], "Q"] as (string | number)[]
  )
  d.push("Z")
  return d.join(" ")
}

function strokePath(stroke: DoodleStroke): string {
  const outline = getStroke(stroke.points, {
    size: stroke.size,
    thinning: 0.6,
    smoothing: 0.5,
    streamline: 0.5,
    simulatePressure: false,
  })
  return outlineToPath(outline)
}

interface DoodleCanvasProps {
  scene: DoodleScene
  editable: boolean
  onChange?: (_scene: DoodleScene) => void
}

export function DoodleCanvas({ scene, editable, onChange }: DoodleCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [current, setCurrent] = useState<DoodleStroke | null>(null)
  const [color, setColor] = useState(PEN_COLORS[0])
  const [size, setSize] = useState(PEN_SIZES[1])
  const [tool, setTool] = useState<"pen" | "eraser">("pen")
  const drawing = useRef(false)

  const toLocal = useCallback((clientX: number, clientY: number): [number, number] => {
    const svg = svgRef.current
    if (!svg) return [0, 0]
    const rect = svg.getBoundingClientRect()
    const x = ((clientX - rect.left) / rect.width) * scene.width
    const y = ((clientY - rect.top) / rect.height) * scene.height
    return [x, y]
  }, [scene.width, scene.height])

  const eraseAt = useCallback((x: number, y: number) => {
    if (!onChange) return
    const threshold = 14
    const remaining = scene.strokes.filter(
      (s) => !s.points.some(([px, py]) => Math.hypot(px - x, py - y) < threshold + s.size)
    )
    if (remaining.length !== scene.strokes.length) {
      onChange({ ...scene, strokes: remaining })
    }
  }, [scene, onChange])

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!editable) return
    e.preventDefault()
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    drawing.current = true
    const [x, y] = toLocal(e.clientX, e.clientY)
    if (tool === "eraser") {
      eraseAt(x, y)
      return
    }
    setCurrent({ points: [[x, y, e.pressure || 0.5]], color, size })
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!editable || !drawing.current) return
    const [x, y] = toLocal(e.clientX, e.clientY)
    if (tool === "eraser") {
      eraseAt(x, y)
      return
    }
    setCurrent((prev) =>
      prev ? { ...prev, points: [...prev.points, [x, y, e.pressure || 0.5]] } : prev
    )
  }

  const handlePointerUp = () => {
    if (!editable) return
    drawing.current = false
    if (current && current.points.length > 0 && onChange) {
      onChange({ ...scene, strokes: [...scene.strokes, current] })
    }
    setCurrent(null)
  }

  const undo = () => {
    if (!onChange || scene.strokes.length === 0) return
    onChange({ ...scene, strokes: scene.strokes.slice(0, -1) })
  }

  const clear = () => {
    if (!onChange) return
    onChange({ ...scene, strokes: [] })
  }

  return (
    <div className="inline-block max-w-full">
      {editable && (
        <div className="flex flex-wrap items-center gap-2 mb-2 rounded-md border bg-gray-50 p-2">
          <Button
            type="button"
            size="sm"
            variant={tool === "pen" ? "default" : "outline"}
            className="h-7 px-2"
            onClick={() => setTool("pen")}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant={tool === "eraser" ? "default" : "outline"}
            className="h-7 px-2"
            onClick={() => setTool("eraser")}
          >
            <Eraser className="h-3.5 w-3.5" />
          </Button>
          <div className="flex items-center gap-1">
            {PEN_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Barva ${c}`}
                onClick={() => { setColor(c); setTool("pen") }}
                className={`h-5 w-5 rounded-full border ${color === c ? "ring-2 ring-offset-1 ring-primary-500" : ""}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <div className="flex items-center gap-1">
            {PEN_SIZES.map((s) => (
              <button
                key={s}
                type="button"
                aria-label={`Tloušťka ${s}`}
                onClick={() => { setSize(s); setTool("pen") }}
                className={`flex h-6 w-6 items-center justify-center rounded border ${size === s ? "border-primary-500 bg-primary-50" : "border-gray-300"}`}
              >
                <span className="rounded-full bg-gray-800" style={{ width: s + 2, height: s + 2 }} />
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-1">
            <Button type="button" size="sm" variant="outline" className="h-7 px-2" onClick={undo}>
              <Undo2 className="h-3.5 w-3.5" />
            </Button>
            <Button type="button" size="sm" variant="outline" className="h-7 px-2" onClick={clear}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${scene.width} ${scene.height}`}
        width={scene.width}
        height={scene.height}
        className="max-w-full rounded-md border border-gray-200 bg-white"
        style={{ touchAction: editable ? "none" : "auto", cursor: editable ? "crosshair" : "default" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        {scene.background?.src && (
          <image
            href={scene.background.src}
            x={0}
            y={0}
            width={scene.width}
            height={scene.height}
            preserveAspectRatio="xMidYMid meet"
          />
        )}
        {scene.strokes.map((s, i) => (
          <path key={i} d={strokePath(s)} fill={s.color} />
        ))}
        {current && <path d={strokePath(current)} fill={current.color} />}
      </svg>
    </div>
  )
}
