"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Check, X, Edit } from "lucide-react"

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

export function SubjectTable({ subjects, loading, onUpdate }: SubjectTableProps) {
  const [editingDates, setEditingDates] = useState<{ [key: string]: boolean }>({})
  const [tempDates, setTempDates] = useState<{
    [key: string]: { final_date?: string; grade?: string }
  }>({})
  const supabase = createClient()

  const handleCheckboxChange = async (subjectId: string, field: string, value: boolean) => {
    const { error } = await supabase
      .from("subjects")
      .update({ [field]: value })
      .eq("id", subjectId)

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
            <TableHead className="w-[60px]">Zp</TableHead>
            <TableHead className="w-[60px]">Zk</TableHead>
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
          {subjects.map((subject) => (
            <TableRow key={subject.id} className="hover:bg-gray-50">
              <TableCell className="font-medium text-sm">{subject.semester}</TableCell>
              <TableCell className="font-mono text-sm">{subject.abbreviation}</TableCell>
              <TableCell className="text-sm">{subject.name}</TableCell>
              <TableCell>{getSubjectTypeBadge(subject.subject_type)}</TableCell>
              <TableCell>{getCompletionBadge(subject.completion_type)}</TableCell>
              <TableCell>
                <Checkbox
                  checked={subject.credit_completed}
                  onCheckedChange={(checked) =>
                    handleCheckboxChange(subject.id, "credit_completed", checked as boolean)
                  }
                />
              </TableCell>
              <TableCell>
                <Checkbox
                  checked={subject.exam_completed}
                  onCheckedChange={(checked) => handleCheckboxChange(subject.id, "exam_completed", checked as boolean)}
                />
              </TableCell>
              <TableCell className="text-center font-medium">{subject.credits}</TableCell>
              <TableCell className="text-center">{subject.hours || "-"}</TableCell>
              <TableCell className="text-center font-medium">{subject.points || "-"}</TableCell>
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
              <TableCell className="text-sm">{subject.lecturer || "-"}</TableCell>
              <TableCell className="text-sm">{subject.department || "-"}</TableCell>
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
    </div>
  )
}
