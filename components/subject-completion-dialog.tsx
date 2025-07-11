"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

interface Subject {
  id: string
  name: string
  completion_type: string
  points?: number
  grade?: string
}

interface SubjectCompletionDialogProps {
  subject: Subject | null
  completionType: "credit" | "exam"
  isOpen: boolean
  onClose: () => void
  onSave: (data: {
    points?: number
    grade?: string
    finalDate?: string
  }) => void
}

const gradeOptions = [
  { value: "A", label: "A (výborně)" },
  { value: "B", label: "B (velmi dobře)" },
  { value: "C", label: "C (dobře)" },
  { value: "D", label: "D (uspokojivě)" },
  { value: "E", label: "E (dostatečně)" },
  { value: "F", label: "F (nedostatečně)" },
  { value: "Zp", label: "Zápočet" },
]

export function SubjectCompletionDialog({
  subject,
  completionType,
  isOpen,
  onClose,
  onSave
}: SubjectCompletionDialogProps) {
  const [points, setPoints] = useState<string>(subject?.points?.toString() || "")
  const [grade, setGrade] = useState<string>(subject?.grade || "")
  const [finalDate, setFinalDate] = useState<string>("")

  const handleSave = () => {
    const data: {
      points?: number
      grade?: string
      finalDate?: string
    } = {}

    if (points) {
      const pointsNum = Number.parseInt(points)
      if (!Number.isNaN(pointsNum)) {
        data.points = pointsNum
      }
    }

    if (grade) {
      data.grade = grade
    }

    if (finalDate) {
      data.finalDate = finalDate
    }

    onSave(data)
    onClose()
  }

  const getCompletionTypeText = () => {
    if (!subject) return ""
    
    const types = subject.completion_type.toLowerCase()
    
    if (completionType === "credit") {
      if (types.includes("zp")) return "Zápočet"
      if (types.includes("kzp")) return "Klasifikovaný zápočet"
      return "Zápočet"
    } else {
      if (types.includes("zk")) return "Zkouška"
      return "Zkouška"
    }
  }

  const shouldShowGrade = () => {
    if (!subject) return false
    
    const types = subject.completion_type.toLowerCase()
    
    if (completionType === "credit") {
      // Show grade for KZp (Klasifikovaný zápočet)
      return types.includes("kzp") || types.includes("klasifikovaný")
    } else {
      // Show grade for Zk (Zkouška)
      return types.includes("zk") || types.includes("zkouška")
    }
  }

  if (!subject) return null

  console.log("Dialog debug:", { subject, completionType, shouldShowGrade: shouldShowGrade() })

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Dokončení: {getCompletionTypeText()}</DialogTitle>
          <DialogDescription>
            {subject.name} - Zadejte detaily o dokončení předmětu
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Points */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="points" className="text-right">
              Body
            </Label>
            <Input
              id="points"
              type="number"
              min="0"
              max="100"
              value={points}
              onChange={(e) => setPoints(e.target.value)}
              placeholder="např. 85"
              className="col-span-3"
            />
          </div>

          {/* Grade - only show if relevant */}
          {shouldShowGrade() && (
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="grade" className="text-right">
                Známka
              </Label>
              <Select value={grade} onValueChange={setGrade}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Vyberte známku" />
                </SelectTrigger>
                <SelectContent>
                  {gradeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Final Date */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="finalDate" className="text-right">
              Datum
            </Label>
            <Input
              id="finalDate"
              type="date"
              value={finalDate}
              onChange={(e) => setFinalDate(e.target.value)}
              className="col-span-3"
            />
          </div>
        </div>

        <DialogFooter className="flex flex-row justify-end space-x-2">
          <Button variant="outline" onClick={onClose}>
            Zrušit
          </Button>
          <Button onClick={handleSave} className="bg-primary-600 hover:bg-primary-700 text-white">
            Uložit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}