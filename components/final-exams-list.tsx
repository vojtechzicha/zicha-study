"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, BookOpen, Calendar, User, Users, Edit, Trash2, GraduationCap } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { formatDateCzech } from "@/lib/utils"
import { FinalExamDialog } from "./final-exam-dialog"
import type { FinalExam } from "@/lib/constants"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
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

interface FinalExamsListProps {
  studyId: string
  isPublic?: boolean
  onUpdate?: () => void
}

export function FinalExamsList({ studyId, isPublic = false, onUpdate }: FinalExamsListProps) {
  const [finalExams, setFinalExams] = useState<FinalExam[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [editingExam, setEditingExam] = useState<FinalExam | null>(null)
  const [deletingExamId, setDeletingExamId] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    loadFinalExams()
  }, [studyId])

  const loadFinalExams = async () => {
    try {
      const { data, error } = await supabase
        .from("final_exams")
        .select("*")
        .eq("study_id", studyId)
        .order("created_at", { ascending: true })

      if (error) throw error
      setFinalExams(data || [])
    } catch (error) {
      console.error("Error loading final exams:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from("final_exams")
        .delete()
        .eq("id", id)

      if (error) throw error
      
      await loadFinalExams()
      onUpdate?.()
    } catch (error) {
      console.error("Error deleting final exam:", error)
    } finally {
      setDeletingExamId(null)
    }
  }

  const handleSave = async () => {
    await loadFinalExams()
    onUpdate?.()
    setShowAddDialog(false)
    setEditingExam(null)
  }


  if (loading) {
    return (
      <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
        <CardContent className="p-6">
          <p className="text-center text-muted-foreground">Načítání státních zkoušek...</p>
        </CardContent>
      </Card>
    )
  }

  const getGradeBadgeVariant = (grade: string): "default" | "secondary" | "destructive" => {
    if (grade === "A" || grade === "B") return "default"
    if (grade === "F") return "destructive"
    return "secondary"
  }

  const getGradeBadgeClass = (grade: string): string => {
    if (grade === "A" || grade === "B") return "bg-green-100 text-green-700 border-green-200"
    if (grade === "F") return "bg-red-100 text-red-700 border-red-200"
    return ""
  }

  return (
    <>
      <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-primary-600" />
              <CardTitle className="text-xl font-bold text-gray-900">Státní závěrečné zkoušky</CardTitle>
            </div>
            {!isPublic && (
              <Button
                size="sm"
                onClick={() => setShowAddDialog(true)}
                className="bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800"
              >
                <Plus className="mr-2 h-4 w-4" />
                Přidat předmět SZZ
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {finalExams.length === 0 ? (
            <div className="text-center py-12">
              <GraduationCap className="mx-auto h-12 w-12 text-gray-400 mb-3" />
              <p className="text-muted-foreground">
                Zatím nejsou přidány žádné předměty státní závěrečné zkoušky
              </p>
            </div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="md:hidden p-4 space-y-3">
                {finalExams.map((exam) => (
                  <div
                    key={exam.id}
                    className="group relative rounded-lg border p-4 hover:bg-primary-50/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-3">
                          {exam.shortcut && (
                            <Badge variant="outline" className="font-mono shrink-0">
                              {exam.shortcut}
                            </Badge>
                          )}
                          <div className="flex-1">
                            <h4 className="font-medium text-base">{exam.name}</h4>
                            
                            <div className="flex flex-wrap gap-4 mt-2 text-sm text-muted-foreground">
                              {exam.exam_date && (
                                <div className="flex items-center gap-1">
                                  <Calendar className="h-3.5 w-3.5" />
                                  <span>{formatDateCzech(exam.exam_date)}</span>
                                </div>
                              )}
                              {exam.examiner && (
                                <div className="flex items-center gap-1">
                                  <User className="h-3.5 w-3.5" />
                                  <span>{exam.examiner}</span>
                                </div>
                              )}
                              {exam.examination_committee_head && (
                                <div className="flex items-center gap-1">
                                  <Users className="h-3.5 w-3.5" />
                                  <span>Předseda: {exam.examination_committee_head}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        {exam.grade && (
                          <Badge
                            variant={getGradeBadgeVariant(exam.grade)}
                            className={getGradeBadgeClass(exam.grade)}
                          >
                            {exam.grade}
                          </Badge>
                        )}
                        
                        {!isPublic && (
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditingExam(exam)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Smazat předmět SZZ?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Opravdu chcete smazat předmět "{exam.name}"? Tato akce je nevratná.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Zrušit</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDelete(exam.id)}
                                    className="bg-red-600 hover:bg-red-700"
                                  >
                                    Smazat
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">Zkratka</TableHead>
                      <TableHead className="min-w-[250px]">Název předmětu</TableHead>
                      <TableHead className="w-[100px]">Hodnocení</TableHead>
                      <TableHead className="w-[120px]">Datum zkoušky</TableHead>
                      <TableHead>Zkoušející</TableHead>
                      <TableHead>Předseda komise</TableHead>
                      {!isPublic && <TableHead className="w-[100px] text-right">Akce</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {finalExams.map((exam) => (
                      <TableRow key={exam.id} className="hover:bg-primary-50">
                        <TableCell className="font-mono text-sm">
                          {exam.shortcut ? (
                            <Badge variant="outline" className="font-mono">
                              {exam.shortcut}
                            </Badge>
                          ) : (
                            <span className="text-gray-400">–</span>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{exam.name}</TableCell>
                        <TableCell>
                          {exam.grade ? (
                            <Badge
                              variant={getGradeBadgeVariant(exam.grade)}
                              className={getGradeBadgeClass(exam.grade)}
                            >
                              {exam.grade}
                            </Badge>
                          ) : (
                            <span className="text-gray-400">–</span>
                          )}
                        </TableCell>
                        <TableCell>{exam.exam_date ? formatDateCzech(exam.exam_date) : <span className="text-gray-400">–</span>}</TableCell>
                        <TableCell className="text-sm">{exam.examiner || <span className="text-gray-400">–</span>}</TableCell>
                        <TableCell className="text-sm">{exam.examination_committee_head || <span className="text-gray-400">–</span>}</TableCell>
                        {!isPublic && (
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setEditingExam(exam)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Smazat předmět SZZ?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Opravdu chcete smazat předmět "{exam.name}"? Tato akce je nevratná.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Zrušit</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDelete(exam.id)}
                                      className="bg-red-600 hover:bg-red-700"
                                    >
                                      Smazat
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {showAddDialog && (
        <FinalExamDialog
          studyId={studyId}
          onClose={() => setShowAddDialog(false)}
          onSave={handleSave}
        />
      )}

      {editingExam && (
        <FinalExamDialog
          studyId={studyId}
          exam={editingExam}
          onClose={() => setEditingExam(null)}
          onSave={handleSave}
        />
      )}

    </>
  )
}