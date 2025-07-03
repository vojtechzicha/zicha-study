"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Check, X, Edit } from "lucide-react"
import { SubjectCompletionDialog } from "./subject-completion-dialog"

interface Subject {
  id: string
  study_id: string
  semester: string
  abbreviation: string
  name: string
  completion_type: string
  subject_type: string
  credits: number
  hours?: number
  points?: number
  grade?: string
  lecturer?: string
  department?: string
  completed: boolean
  exam_completed: boolean
  credit_completed: boolean
  final_date?: string
  created_at: string
}

interface SubjectTableProps {
  subjects: Subject[]
  loading: boolean
  onUpdate: () => void
}

const sortSubjects = (subjects: Subject[]) => {
  const typeOrder = {
    Povinný: 1,
    "Povinně volitelný": 2,
    Volitelný: 3,
    Ostatní: 4,
  }

  // Custom semester sorting function
  const getSemesterOrder = (semester: string) => {
    // Extract year and semester type
    const match = semester.match(/(\d+)\.\s*ročník\s*(ZS|LS)/i)
    if (match) {
      const year = Number.parseInt(match[1])
      const semesterType = match[2].toUpperCase()
      // ZS (winter) comes before LS (summer) in the same year
      return year * 10 + (semesterType === "ZS" ? 1 : 2)
    }
    // Fallback for non-standard semester names
    return 999
  }

  return [...subjects].sort((a, b) => {
    // First sort by semester with proper ZS/LS ordering
    const aSemesterOrder = getSemesterOrder(a.semester)
    const bSemesterOrder = getSemesterOrder(b.semester)
    if (aSemesterOrder !== bSemesterOrder) {
      return aSemesterOrder - bSemesterOrder
    }

    // Then sort by subject type
    const aTypeOrder = typeOrder[a.subject_type as keyof typeof typeOrder] || 5
    const bTypeOrder = typeOrder[b.subject_type as keyof typeof typeOrder] || 5
    if (aTypeOrder !== bTypeOrder) {
      return aTypeOrder - bTypeOrder
    }

    // Finally sort alphabetically by name
    return a.name.localeCompare(b.name, "cs")
  })
}

export function SubjectTable({ subjects, loading, onUpdate }: SubjectTableProps) {
  const [editingDates, setEditingDates] = useState<{ [key: string]: boolean }>({})
  const [tempDates, setTempDates] = useState<{
    [key: string]: {
      final_date?: string
      grade?: string
      lecturer?: string
      department?: string
      points?: string
      hours?: string
    }
  }>({})
  
  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null)
  const [completionType, setCompletionType] = useState<"credit" | "exam">("credit")
  const supabase = createClient()

  // Helper function to determine which completion types to show for a subject
  const getCompletionTypes = (completionType: string) => {
    const types = completionType.toLowerCase()
    return {
      hasCredit: types.includes("zp") || types.includes("kzp") || types.includes("zápočet"),
      hasExam: types.includes("zk") || types.includes("zkouška")
    }
  }

  const handleCheckboxChange = async (subjectId: string, field: string, value: boolean) => {
    if (value) {
      // If checking the checkbox, open the completion dialog
      const subject = subjects.find(s => s.id === subjectId)
      if (subject) {
        setSelectedSubject(subject)
        setCompletionType(field === "credit_completed" ? "credit" : "exam")
        setDialogOpen(true)
      }
    } else {
      // If unchecking, just update directly
      const { error } = await supabase
        .from("subjects")
        .update({ [field]: value })
        .eq("id", subjectId)

      if (!error) {
        onUpdate()
      }
    }
  }

  const handleCompletionSave = async (data: {
    points?: number
    grade?: string
    finalDate?: string
  }) => {
    if (!selectedSubject) return

    const updateData: any = {
      [completionType === "credit" ? "credit_completed" : "exam_completed"]: true
    }

    if (data.points !== undefined) {
      updateData.points = data.points
    }
    if (data.grade) {
      updateData.grade = data.grade
    }
    if (data.finalDate) {
      updateData.final_date = data.finalDate
    }

    const { error } = await supabase
      .from("subjects")
      .update(updateData)
      .eq("id", selectedSubject.id)

    if (!error) {
      onUpdate()
    }
  }

  const handleEdit = (subjectId: string) => {
    const subject = subjects.find((s) => s.id === subjectId)
    if (subject) {
      setTempDates({
        ...tempDates,
        [subjectId]: {
          final_date: subject.final_date || "",
          grade: subject.grade || "",
          lecturer: subject.lecturer || "",
          department: subject.department || "",
          points: subject.points?.toString() || "",
          hours: subject.hours?.toString() || "",
        },
      })
      setEditingDates({ ...editingDates, [subjectId]: true })
    }
  }

  const handleSave = async (subjectId: string) => {
    const data = tempDates[subjectId]
    if (data) {
      const { error } = await supabase
        .from("subjects")
        .update({
          final_date: data.final_date || null,
          grade: data.grade || null,
          lecturer: data.lecturer || null,
          department: data.department || null,
          points: data.points ? Number.parseInt(data.points) : null,
          hours: data.hours ? Number.parseInt(data.hours) : null,
        })
        .eq("id", subjectId)

      if (!error) {
        setEditingDates({ ...editingDates, [subjectId]: false })
        onUpdate()
      }
    }
  }

  const handleCancel = (subjectId: string) => {
    setEditingDates({ ...editingDates, [subjectId]: false })
    const newTempDates = { ...tempDates }
    delete newTempDates[subjectId]
    setTempDates(newTempDates)
  }

  const getCompletionBadge = (type: string) => {
    const shortType = type.match(/$$([^)]+)$$/)?.[1] || type
    switch (shortType) {
      case "Zp+Zk":
        return (
          <Badge variant="outline" className="text-xs">
            Zp+Zk
          </Badge>
        )
      case "Zp":
        return (
          <Badge variant="outline" className="text-xs bg-green-50 text-green-700">
            Zp
          </Badge>
        )
      case "KZp":
        return (
          <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700">
            KZp
          </Badge>
        )
      case "Zk":
        return (
          <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">
            Zk
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="text-xs">
            {shortType}
          </Badge>
        )
    }
  }

  const getSubjectTypeBadge = (type: string) => {
    switch (type) {
      case "Povinný":
        return (
          <Badge variant="outline" className="text-xs bg-red-50 text-red-700">
            P
          </Badge>
        )
      case "Povinně volitelný":
        return (
          <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700">
            PV
          </Badge>
        )
      case "Volitelný":
        return (
          <Badge variant="outline" className="text-xs bg-green-50 text-green-700">
            V
          </Badge>
        )
      case "Ostatní":
        return (
          <Badge variant="outline" className="text-xs bg-gray-50 text-gray-700">
            O
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="text-xs">
            {type}
          </Badge>
        )
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-12 bg-gray-100 rounded animate-pulse"></div>
        ))}
      </div>
    )
  }

  if (subjects.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 mb-4">Zatím nemáte žádné předměty</p>
        <p className="text-sm text-gray-500">Přidejte první předmět pomocí tlačítka výše</p>
      </div>
    )
  }

  const sortedSubjects = sortSubjects(subjects)

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[120px]">Semestr</TableHead>
            <TableHead className="w-[100px]">Zkratka</TableHead>
            <TableHead className="min-w-[200px]">Předmět</TableHead>
            <TableHead className="w-[60px]">Typ</TableHead>
            <TableHead className="w-[80px]">Ukončení</TableHead>
            <TableHead className="w-[60px]">Zápočet</TableHead>
            <TableHead className="w-[60px]">Zkouška</TableHead>
            <TableHead className="w-[80px]">Kredity</TableHead>
            <TableHead className="w-[80px]">Hodiny</TableHead>
            <TableHead className="w-[80px]">Body</TableHead>
            <TableHead className="w-[100px]">Známka</TableHead>
            <TableHead className="w-[150px]">Přednášející</TableHead>
            <TableHead className="w-[120px]">Katedra</TableHead>
            <TableHead className="w-[120px]">Datum ukončení</TableHead>
            <TableHead className="w-[80px]">Akce</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedSubjects.map((subject) => (
            <TableRow key={subject.id} className="hover:bg-gray-50">
              <TableCell className="font-medium text-sm">{subject.semester}</TableCell>
              <TableCell className="font-mono text-sm">{subject.abbreviation}</TableCell>
              <TableCell className="text-sm">{subject.name}</TableCell>
              <TableCell>{getSubjectTypeBadge(subject.subject_type)}</TableCell>
              <TableCell>{getCompletionBadge(subject.completion_type)}</TableCell>
              {(() => {
                const completionTypes = getCompletionTypes(subject.completion_type)
                return (
                  <>
                    {/* Zápočet column */}
                    <TableCell>
                      {completionTypes.hasCredit && (
                        <Checkbox
                          checked={subject.credit_completed}
                          onCheckedChange={(checked) =>
                            handleCheckboxChange(subject.id, "credit_completed", checked as boolean)
                          }
                        />
                      )}
                    </TableCell>
                    
                    {/* Zkouška column */}
                    <TableCell>
                      {completionTypes.hasExam && (
                        <Checkbox
                          checked={subject.exam_completed}
                          onCheckedChange={(checked) => handleCheckboxChange(subject.id, "exam_completed", checked as boolean)}
                        />
                      )}
                    </TableCell>
                  </>
                )
              })()}
              <TableCell className="text-center font-medium">{subject.credits}</TableCell>
              <TableCell className="text-center">
                {editingDates[subject.id] ? (
                  <Input
                    type="number"
                    value={tempDates[subject.id]?.hours || ""}
                    onChange={(e) =>
                      setTempDates({
                        ...tempDates,
                        [subject.id]: {
                          ...tempDates[subject.id],
                          hours: e.target.value,
                        },
                      })
                    }
                    className="w-full text-xs"
                    placeholder="hodiny"
                    min="0"
                  />
                ) : (
                  <span className="text-sm">{subject.hours || "-"}</span>
                )}
              </TableCell>
              <TableCell className="text-center font-medium">
                {editingDates[subject.id] ? (
                  <Input
                    type="number"
                    value={tempDates[subject.id]?.points || ""}
                    onChange={(e) =>
                      setTempDates({
                        ...tempDates,
                        [subject.id]: {
                          ...tempDates[subject.id],
                          points: e.target.value,
                        },
                      })
                    }
                    className="w-full text-xs"
                    placeholder="body"
                    min="0"
                    max="100"
                  />
                ) : (
                  <span className="text-sm">{subject.points || "-"}</span>
                )}
              </TableCell>
              <TableCell>
                {editingDates[subject.id] ? (
                  <Input
                    value={tempDates[subject.id]?.grade || ""}
                    onChange={(e) =>
                      setTempDates({
                        ...tempDates,
                        [subject.id]: {
                          ...tempDates[subject.id],
                          grade: e.target.value,
                        },
                      })
                    }
                    className="w-full text-xs"
                    placeholder="známka"
                  />
                ) : (
                  <span className="text-sm">{subject.grade || "-"}</span>
                )}
              </TableCell>
              <TableCell>
                {editingDates[subject.id] ? (
                  <Input
                    value={tempDates[subject.id]?.lecturer || ""}
                    onChange={(e) =>
                      setTempDates({
                        ...tempDates,
                        [subject.id]: {
                          ...tempDates[subject.id],
                          lecturer: e.target.value,
                        },
                      })
                    }
                    className="w-full text-xs"
                    placeholder="přednášející"
                  />
                ) : (
                  <span className="text-sm">{subject.lecturer || "-"}</span>
                )}
              </TableCell>
              <TableCell>
                {editingDates[subject.id] ? (
                  <Input
                    value={tempDates[subject.id]?.department || ""}
                    onChange={(e) =>
                      setTempDates({
                        ...tempDates,
                        [subject.id]: {
                          ...tempDates[subject.id],
                          department: e.target.value,
                        },
                      })
                    }
                    className="w-full text-xs"
                    placeholder="katedra"
                  />
                ) : (
                  <span className="text-sm">{subject.department || "-"}</span>
                )}
              </TableCell>
              <TableCell>
                {editingDates[subject.id] ? (
                  <Input
                    type="date"
                    value={tempDates[subject.id]?.final_date || ""}
                    onChange={(e) =>
                      setTempDates({
                        ...tempDates,
                        [subject.id]: {
                          ...tempDates[subject.id],
                          final_date: e.target.value,
                        },
                      })
                    }
                    className="w-full text-xs"
                  />
                ) : (
                  <span className="text-sm text-gray-600">
                    {subject.final_date ? new Date(subject.final_date).toLocaleDateString("cs-CZ") : "-"}
                  </span>
                )}
              </TableCell>
              <TableCell>
                {editingDates[subject.id] ? (
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => handleSave(subject.id)} className="h-8 w-8 p-0">
                      <Check className="h-4 w-4 text-green-600" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleCancel(subject.id)} className="h-8 w-8 p-0">
                      <X className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => handleEdit(subject.id)} className="h-8 w-8 p-0">
                    <Edit className="h-4 w-4" />
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      
      <SubjectCompletionDialog
        subject={selectedSubject}
        completionType={completionType}
        isOpen={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSave={handleCompletionSave}
      />
    </div>
  )
}
