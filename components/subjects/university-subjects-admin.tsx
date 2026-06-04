"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Plus, BookOpen, Search, Filter } from "lucide-react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { SubjectForm } from "@/components/subject-form"
import { SubjectTable } from "@/components/subject-table"
import type { StudySubjectsAdminProps } from "./types"

export function UniversitySubjectsAdmin({ study, subjects, loading, onUpdate }: StudySubjectsAdminProps) {
  const [showSubjectForm, setShowSubjectForm] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [showActiveOnly, setShowActiveOnly] = useState(false)

  // Filter subjects based on search query and active filter
  const filteredSubjects = useMemo(() => {
    let filtered = subjects

    if (showActiveOnly) {
      filtered = subjects.filter((s) => !s.completed && !s.planned)
    }

    if (!searchQuery.trim()) {
      return filtered
    }

    const query = searchQuery.toLowerCase().trim()
    return filtered.filter((subject) => {
      const searchableFields = [
        subject.name?.toLowerCase() || "",
        subject.abbreviation?.toLowerCase() || "",
        subject.department?.toLowerCase() || "",
        subject.lecturer?.toLowerCase() || "",
        subject.completion_type?.toLowerCase() || "",
        subject.subject_type?.toLowerCase() || "",
        subject.semester?.toLowerCase() || "",
      ]
      return searchableFields.some((field) => field.includes(query))
    })
  }, [subjects, searchQuery, showActiveOnly])

  const handleSubjectAdded = () => {
    setShowSubjectForm(false)
    onUpdate()
  }

  return (
    <>
      <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary-600" />
                <CardTitle className="text-xl font-bold text-gray-900">Předměty</CardTitle>
              </div>
              <p className="text-sm text-gray-600 mt-1 ml-7">
                {searchQuery || showActiveOnly
                  ? `Zobrazeno ${filteredSubjects.length} z ${subjects.length} předmětů`
                  : "Přehled všech předmětů ve studiu"}
              </p>
            </div>
            {/* Search Input with Filter and Add button - Right side on desktop, below on mobile */}
            <div className="w-full md:w-auto relative flex gap-2 items-center">
              <div className="flex-1 md:flex-initial md:w-64 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Hledat v předmětech..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-10"
                />
              </div>
              <Button
                variant="outline"
                onClick={() => setShowActiveOnly(!showActiveOnly)}
                className={`h-10 w-10 p-0 flex-shrink-0 ${
                  showActiveOnly
                    ? "bg-primary-600 text-white border-primary-600 hover:bg-primary-700"
                    : "text-gray-600 hover:bg-primary-100 hover:text-gray-900"
                }`}
                title={showActiveOnly ? "Zobrazit všechny předměty" : "Zobrazit pouze aktivní předměty"}
              >
                <Filter className={`h-4 w-4 ${showActiveOnly ? "text-white" : "text-gray-600"}`} />
              </Button>
              <Button
                onClick={() => setShowSubjectForm(true)}
                size="sm"
                className="bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800"
              >
                <Plus className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Přidat předmět</span>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <SubjectTable subjects={filteredSubjects} loading={loading} onUpdate={onUpdate} hideFilters study={study} />
        </CardContent>
      </Card>

      {/* Subject Form Modal */}
      <Dialog open={showSubjectForm} onOpenChange={setShowSubjectForm}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <SubjectForm study={study as any} onSuccess={handleSubjectAdded} onClose={() => setShowSubjectForm(false)} />
        </DialogContent>
      </Dialog>
    </>
  )
}
