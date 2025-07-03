"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Save } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { isFieldVisibleForState } from "@/lib/status-utils"

interface Subject {
  id: string
  name: string
  completion_type: string
  points?: number
  grade?: string
  final_date?: string
  completed: boolean
  exam_completed: boolean
  credit_completed: boolean
  planned?: boolean
}

interface SubjectCompletionModalProps {
  subject: Subject
  completionType: "credit" | "exam"
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export function SubjectCompletionModal({ 
  subject, 
  completionType, 
  open, 
  onClose, 
  onSuccess 
}: SubjectCompletionModalProps) {
  const [formData, setFormData] = useState({
    points: subject.points?.toString() || "",
    grade: subject.grade || "",
    final_date: subject.final_date || "",
    markAsCompleted: false,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  // Determine current state based on subject properties
  const currentState = subject.planned ? "planned" : subject.completed ? "completed" : "active"

  const isCredit = completionType === "credit"
  const title = isCredit ? "Zápočet splněn" : "Zkouška splněna"
  const fieldName = isCredit ? "credit_completed" : "exam_completed"

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const updates: any = {
      [fieldName]: true,
    }

    // Update points and grade if visible for current state
    if (isFieldVisibleForState("points", currentState) && formData.points) {
      updates.points = Number.parseInt(formData.points)
    }
    if (isFieldVisibleForState("grade", currentState) && formData.grade) {
      updates.grade = formData.grade
    }

    // If marking as completed, update completion status and final_date
    if (formData.markAsCompleted) {
      updates.completed = true
      updates.planned = false
      updates.final_date = formData.final_date || new Date().toISOString().split('T')[0]
    }

    const { error } = await supabase
      .from("subjects")
      .update(updates)
      .eq("id", subject.id)

    if (error) {
      setError("Chyba při ukládání. Zkuste to prosím znovu.")
      setLoading(false)
    } else {
      onSuccess()
      onClose()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="text-sm text-gray-600 mb-4">
            <strong>{subject.name}</strong>
          </div>

          {/* Points */}
          {isFieldVisibleForState("points", currentState) && (
            <div className="space-y-2">
              <Label htmlFor="points">Počet bodů</Label>
              <Input
                id="points"
                type="number"
                value={formData.points}
                onChange={(e) => setFormData({ ...formData, points: e.target.value })}
                min="0"
                max="100"
                placeholder="počet bodů"
              />
            </div>
          )}

          {/* Grade */}
          {isFieldVisibleForState("grade", currentState) && (
            <div className="space-y-2">
              <Label htmlFor="grade">Známka</Label>
              <Input
                id="grade"
                value={formData.grade}
                onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
                placeholder="např. A, 1, výborně"
              />
            </div>
          )}

          {/* Mark as Completed Option */}
          <div className="flex items-center space-x-2 p-3 border rounded-lg bg-blue-50">
            <Checkbox
              id="markAsCompleted"
              checked={formData.markAsCompleted}
              onCheckedChange={(checked) => 
                setFormData({ ...formData, markAsCompleted: checked as boolean })
              }
              className="peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              style={formData.markAsCompleted ? {
                backgroundColor: 'rgb(37, 99, 235)',
                borderColor: 'rgb(37, 99, 235)',
                color: 'white'
              } : {}}
            />
            <Label htmlFor="markAsCompleted" className="cursor-pointer">
              Označit předmět jako dokončený
            </Label>
          </div>

          {/* Final Date (if marking as completed) */}
          {formData.markAsCompleted && (
            <div className="space-y-2">
              <Label htmlFor="final_date">Datum ukončení *</Label>
              <Input
                id="final_date"
                type="date"
                value={formData.final_date}
                onChange={(e) => setFormData({ ...formData, final_date: e.target.value })}
                required
              />
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Zrušit
            </Button>
            <Button
              type="submit"
              disabled={loading || (formData.markAsCompleted && !formData.final_date)}
              className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white"
            >
              <Save className="mr-2 h-4 w-4" />
              {loading ? "Ukládání..." : "Uložit"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}