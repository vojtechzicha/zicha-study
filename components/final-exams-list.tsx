"use client"

import React, { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, Calendar, User, Users, Edit, Trash2, GraduationCap, ChevronDown, ChevronRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { formatDateCzech } from "@/lib/utils"
import { FinalExamDialog } from "./final-exam-dialog"
import { FinalExamStudyNotesSection } from "./final-exam-study-notes-section"
import type { FinalExam } from "@/lib/constants"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getGradeBadgeConfig, getSubjectStateBadgeConfig, SubjectState } from "@/lib/status-utils"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
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
  studySlug?: string
  onUpdate?: () => void
}

export function FinalExamsList({ studyId, isPublic = false, studySlug, onUpdate }: FinalExamsListProps) {
  const [finalExams, setFinalExams] = useState<FinalExam[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [editingExam, setEditingExam] = useState<FinalExam | null>(null)
  const [, setDeletingExamId] = useState<string | null>(null)
  const [expandedExamId, setExpandedExamId] = useState<string | null>(null)
  const [, setExamsWithNotes] = useState<Set<string>>(new Set())
  const supabase = createClient()

  const loadFinalExams = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("final_exams")
        .select("*")
        .eq("study_id", studyId)
        .order("created_at", { ascending: true })

      if (error) throw error
      setFinalExams(data || [])

      // Check which exams have study notes
      if (data && data.length > 0) {
        const examIds = data.map((exam: FinalExam) => exam.id)
        const { data: notesData } = await supabase
          .from("study_note_final_exams")
          .select("final_exam_id")
          .in("final_exam_id", examIds)

        if (notesData) {
          const examIdsWithNotes = new Set<string>(notesData.map((n: { final_exam_id: string }) => n.final_exam_id))
          setExamsWithNotes(examIdsWithNotes)
        }
      }
    } catch (error) {
      console.error("Error loading final exams:", error)
    } finally {
      setLoading(false)
    }
  }, [studyId, supabase])

  useEffect(() => {
    loadFinalExams()
  }, [studyId, loadFinalExams])

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

  const getExamAsSubject = (exam: FinalExam) => ({
    id: exam.id,
    grade: exam.grade,
    completed: !!exam.grade && exam.grade !== "F" && exam.grade !== "N",
    exam_completed: !!exam.grade,
    credit_completed: false,
    planned: !exam.grade
  })
  
  const getExamStatus = (exam: FinalExam): SubjectState => {
    if (!exam.grade) return "planned"
    if (exam.grade === "F" || exam.grade === "N") return "failed"
    return "completed"
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
                  <Collapsible key={exam.id} open={expandedExamId === exam.id} onOpenChange={(open) => setExpandedExamId(open ? exam.id : null)}>
                    <div className="group relative rounded-lg border p-4 hover:bg-primary-50/50 transition-colors">
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
                        {exam.grade && (() => {
                          const gradeConfig = getGradeBadgeConfig(exam.grade, getExamAsSubject(exam))
                          return (
                            <span className={`px-2 py-1 rounded text-sm font-medium ${gradeConfig.className}`} style={gradeConfig.style}>
                              {exam.grade}
                            </span>
                          )
                        })()}
                        
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
                                    Opravdu chcete smazat předmět &quot;{exam.name}&quot;? Tato akce je nevratná.
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
                    
                    {/* Expand button for study notes - only show in non-public view */}
                    {!isPublic && (
                      <>
                        <div className="flex justify-between items-center pt-3 mt-3 border-t">
                          <CollapsibleTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-gray-600 hover:text-gray-800 w-full justify-start"
                            >
                              {expandedExamId === exam.id ? (
                                <>
                                  <ChevronDown className="h-4 w-4 mr-1" />
                                  Skrýt studijní zápisy
                                </>
                              ) : (
                                <>
                                  <ChevronRight className="h-4 w-4 mr-1" />
                                  Zobrazit studijní zápisy
                                </>
                              )}
                            </Button>
                          </CollapsibleTrigger>
                        </div>
                        
                        <CollapsibleContent>
                          <div className="pt-4 border-t mt-3">
                            <FinalExamStudyNotesSection
                              studyId={studyId}
                              finalExamId={exam.id}
                              studySlug={studySlug}
                              isStudyPublic={isPublic}
                              onUpdate={loadFinalExams}
                            />
                          </div>
                        </CollapsibleContent>
                      </>
                    )}
                  </div>
                </Collapsible>
              ))}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">Zkratka</TableHead>
                      <TableHead className="min-w-[250px]">Předmět</TableHead>
                      <TableHead className="w-[120px]">Hodnocení</TableHead>
                      <TableHead className="w-[120px]">Datum ukončení</TableHead>
                      {isPublic && <TableHead className="w-[60px]">Stav</TableHead>}
                      {!isPublic && <TableHead className="w-[100px] text-right">Akce</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {finalExams.map((exam) => (
                      <React.Fragment key={exam.id}>
                        <TableRow className="hover:bg-primary-50">
                          <TableCell className="font-mono text-sm">
                          {exam.shortcut ? (
                            <Badge variant="outline" className="font-mono">
                              {exam.shortcut}
                            </Badge>
                          ) : (
                            <span className="text-gray-400">–</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          <div>
                            <div>{exam.name}</div>
                            {(exam.examiner || exam.examination_committee_head) && (
                              <div className="text-xs text-gray-500 mt-0.5">
                                {[exam.examiner, exam.examination_committee_head && `Předseda: ${exam.examination_committee_head}`].filter(Boolean).join(' • ')}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          {exam.grade ? (() => {
                            const gradeConfig = getGradeBadgeConfig(exam.grade, getExamAsSubject(exam))
                            return (
                              <span className={`px-2 py-1 rounded text-sm font-medium ${gradeConfig.className}`} style={gradeConfig.style}>
                                {exam.grade}
                              </span>
                            )
                          })() : (
                            <span className="text-gray-400">–</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">{exam.exam_date ? formatDateCzech(exam.exam_date) : <span className="text-gray-400">-</span>}</TableCell>
                        {isPublic && (
                          <TableCell className="text-center">
                            {(() => {
                              const status = getExamStatus(exam)
                              const config = getSubjectStateBadgeConfig(status, getExamAsSubject(exam), true)
                              return (
                                <Badge className={`text-xs ${config.className}`} style={config.style}>
                                  {config.text}
                                </Badge>
                              )
                            })()}
                          </TableCell>
                        )}
                        {!isPublic && (
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setExpandedExamId(expandedExamId === exam.id ? null : exam.id)}
                              >
                                {expandedExamId === exam.id ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </Button>
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
                                      Opravdu chcete smazat předmět &quot;{exam.name}&quot;? Tato akce je nevratná.
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
                      {!isPublic && expandedExamId === exam.id && (
                        <TableRow>
                          <TableCell colSpan={isPublic ? 5 : 5} className="bg-gray-50 p-0">
                            <div className="p-6">
                              <FinalExamStudyNotesSection
                                studyId={studyId}
                                finalExamId={exam.id}
                                studySlug={studySlug}
                                isStudyPublic={isPublic}
                                onUpdate={loadFinalExams}
                              />
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
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