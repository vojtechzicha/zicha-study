"use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BookOpen, TrendingUp, CheckCircle } from "lucide-react"
import {
  overallAverage,
  gradedSubjectCount,
  type HighSchoolSubjectLike,
} from "@/lib/highschool/grades"

interface HighSchoolStatsCardsProps {
  subjects: HighSchoolSubjectLike[]
  variant?: "full" | "simple"
}

export function HighSchoolStatsCards({ subjects, variant = "full" }: HighSchoolStatsCardsProps) {
  const stats = useMemo(() => {
    const average = overallAverage(subjects)
    const totalGrades = subjects.reduce((sum, s) => sum + (s.grades?.length ?? 0), 0)
    return {
      total: subjects.length,
      graded: gradedSubjectCount(subjects),
      average,
      totalGrades,
    }
  }, [subjects])

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
      <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-gray-600">Celkem předmětů</CardTitle>
          <BookOpen className="h-4 w-4 text-primary-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
          <p className="text-xs text-gray-600 mt-1">Hodnoceno: {stats.graded}</p>
        </CardContent>
      </Card>

      <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-gray-600">Studijní průměr</CardTitle>
          <TrendingUp className="h-4 w-4 text-green-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-gray-900">
            {stats.average !== null ? stats.average.toFixed(2) : "–"}
          </div>
          <p className="text-xs text-gray-600 mt-1">průměr všech známek</p>
        </CardContent>
      </Card>

      {variant === "full" && (
        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Zapsané známky</CardTitle>
            <CheckCircle className="h-4 w-4 text-indigo-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">{stats.totalGrades}</div>
            <p className="text-xs text-gray-600 mt-1">napříč všemi pololetími</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
