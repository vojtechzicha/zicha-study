"use client"

import { useState } from "react"
import { createTask, updateTaskAction, deleteTaskAction } from "@/lib/actions/tasks"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Trash2 } from "lucide-react"
import type { Task } from "@/lib/constants"

interface TaskDialogProps {
  studyId: string
  task?: Task | null
  onClose: () => void
  onSave: () => void
}

export function TaskDialog({ studyId, task, onClose, onSave }: TaskDialogProps) {
  const [formData, setFormData] = useState({
    title: task?.title || "",
    description: task?.description || "",
    start_date: task?.start_date || "",
    deadline: task?.deadline || "",
    completed: Boolean(task?.completed_at),
  })
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      if (!formData.title.trim()) throw new Error("Název úkolu je povinný")
      if (!formData.deadline) throw new Error("Termín je povinný")
      if (formData.start_date && formData.start_date > formData.deadline) {
        throw new Error("Začátek nemůže být po termínu")
      }

      const data = {
        study_id: studyId,
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        start_date: formData.start_date || null,
        deadline: formData.deadline,
        completed_at: formData.completed
          ? (task?.completed_at || new Date().toISOString())
          : null,
      }

      if (task) {
        const { error: updateError } = await updateTaskAction(task.id, data)
        if (updateError) throw new Error(updateError.message)
      } else {
        const result = await createTask(data)
        if (result.error) throw new Error(result.error.message)
      }

      onSave()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nastala chyba při ukládání")
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!task) return
    if (!confirm("Opravdu chcete odstranit tento úkol?")) return

    setDeleting(true)
    setError(null)
    try {
      const { error: deleteError } = await deleteTaskAction(task.id)
      if (deleteError) throw new Error(deleteError.message)
      onSave()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nastala chyba při mazání")
      setDeleting(false)
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{task ? "Upravit úkol" : "Přidat úkol"}</DialogTitle>
            <DialogDescription>
              {task
                ? "Upravte informace o úkolu"
                : "Vyplňte informace o novém úkolu"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="task-title">Název *</Label>
              <Input
                id="task-title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="např. Odevzdat semestrální práci"
                required
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="task-description">Popis</Label>
              <Textarea
                id="task-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Volitelný popis, poznámka, odkaz..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="task-start">Začátek</Label>
                <Input
                  id="task-start"
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                />
                <p className="text-xs text-gray-500">Volitelné</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="task-deadline">Termín *</Label>
                <Input
                  id="task-deadline"
                  type="date"
                  value={formData.deadline}
                  onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-lg border bg-primary-50/40 p-3">
              <Checkbox
                id="task-completed"
                checked={formData.completed}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, completed: checked === true })
                }
              />
              <Label htmlFor="task-completed" className="cursor-pointer text-sm font-normal">
                Úkol je splněný
              </Label>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            {task ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={deleting || loading}
              >
                <Trash2 className="mr-1.5 h-4 w-4" />
                {deleting ? "Mažu..." : "Smazat"}
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={loading || deleting}>
                Zrušit
              </Button>
              <Button
                type="submit"
                disabled={loading || deleting}
                className="bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800"
              >
                {loading ? "Ukládání..." : task ? "Uložit" : "Přidat"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
