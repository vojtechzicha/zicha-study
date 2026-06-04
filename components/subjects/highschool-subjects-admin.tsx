"use client"

import { useMemo, useState } from "react"
import { deleteSubjectAction } from "@/lib/actions/subjects"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { BookOpen, Plus, Edit, Trash2 } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { derivePeriods } from "@/lib/highschool/grades"
import { HighSchoolGradeMatrix, type MatrixSubject } from "./highschool-grade-matrix"
import { HighSchoolSubjectForm, type HighSchoolSubject } from "./highschool-subject-form"
import type { StudySubjectsAdminProps } from "./types"

export function HighSchoolSubjectsAdmin({ study, subjects, loading, onUpdate }: StudySubjectsAdminProps) {
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingSubject, setEditingSubject] = useState<HighSchoolSubject | null>(null)
  const { toast } = useToast()

  const hsSubjects = subjects as unknown as HighSchoolSubject[]
  const periods = useMemo(() => derivePeriods(study, hsSubjects), [study, hsSubjects])
  const sortedSubjects = useMemo(
    () => [...hsSubjects].sort((a, b) => a.name.localeCompare(b.name, "cs")),
    [hsSubjects],
  )

  const handleSuccess = () => {
    setShowAddForm(false)
    setEditingSubject(null)
    onUpdate()
  }

  const handleDelete = async (id: string) => {
    const { error } = await deleteSubjectAction(id)
    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" })
      return
    }
    toast({ title: "Předmět smazán" })
    onUpdate()
  }

  const renderActions = (subject: MatrixSubject) => (
    <div className="flex justify-end gap-1">
      <Button size="sm" variant="ghost" onClick={() => setEditingSubject(subject as HighSchoolSubject)}>
        <Edit className="h-4 w-4" />
      </Button>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700 hover:bg-red-50">
            <Trash2 className="h-4 w-4" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Smazat předmět?</AlertDialogTitle>
            <AlertDialogDescription>
              Opravdu chcete smazat předmět &quot;{subject.name}&quot;? Tato akce je nevratná.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zrušit</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleDelete(subject.id)} className="bg-red-600 hover:bg-red-700">
              Smazat
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )

  return (
    <>
      <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary-600" />
              <CardTitle className="text-xl font-bold text-gray-900">Předměty</CardTitle>
            </div>
            <Button
              onClick={() => setShowAddForm(true)}
              size="sm"
              className="bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800"
            >
              <Plus className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Přidat předmět</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : (
            <HighSchoolGradeMatrix subjects={sortedSubjects} periods={periods} renderActions={renderActions} />
          )}
        </CardContent>
      </Card>

      <Dialog open={showAddForm} onOpenChange={setShowAddForm}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <HighSchoolSubjectForm
            study={study}
            periods={periods}
            onSuccess={handleSuccess}
            onClose={() => setShowAddForm(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editingSubject)} onOpenChange={(open) => !open && setEditingSubject(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {editingSubject && (
            <HighSchoolSubjectForm
              study={study}
              periods={periods}
              subject={editingSubject}
              onSuccess={handleSuccess}
              onClose={() => setEditingSubject(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
