"use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { BookOpen, Target, Clock, Trophy, Calendar, TrendingUp } from "lucide-react"
import { calculateStudyStatistics, type StudyStatistics, type StatisticsSubject } from "@/lib/utils/statistics-utils"

interface StudyStatisticsCardsProps {
  subjects: StatisticsSubject[]
  variant?: "full" | "simple"
}

export function StudyStatisticsCards({ subjects, variant = "full" }: StudyStatisticsCardsProps) {
  const stats = useMemo(() => calculateStudyStatistics(subjects), [subjects])

  if (variant === "simple") {
    return <SimpleStatisticsCards stats={stats} />
  }

  return <FullStatisticsCards stats={stats} />
}

// Full statistics display for public view
function FullStatisticsCards({ stats }: { stats: StudyStatistics }) {
  return (
    <>
      {/* Main Statistics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Celkem předmětů</CardTitle>
            <BookOpen className="h-4 w-4 text-primary-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
            <p className="text-xs text-gray-600 mt-1">
              Dokončeno: {stats.completed} ({stats.completionRate.toFixed(1)}%)
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Získané kredity</CardTitle>
            <Target className="h-4 w-4 text-indigo-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">{stats.completedCredits}</div>
            <p className="text-xs text-gray-600 mt-1">z {stats.totalCredits} kreditů</p>
          </CardContent>
        </Card>

        {stats.average.type !== 'none' && (
          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">{stats.average.label}</CardTitle>
              <Trophy className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              {stats.average.type === 'both' ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-center">
                    <div className="text-lg font-bold text-gray-900">
                      {stats.average.pointsValue ? stats.average.pointsValue.toFixed(2) : '-'}
                    </div>
                    <p className="text-xs text-gray-600">body</p>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-gray-900">
                      {stats.average.gradeValue ? stats.average.gradeValue.toFixed(2) : '-'}
                    </div>
                    <p className="text-xs text-gray-600">známky</p>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="text-2xl font-bold text-gray-900">
                    {stats.average.value ? stats.average.value.toFixed(2) : '-'}
                  </div>
                  <p className="text-xs text-gray-600 mt-1">vážené kredity</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Celkové hodiny</CardTitle>
            <Clock className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">{stats.completedHours}</div>
            <p className="text-xs text-gray-600 mt-1">
              z {stats.totalHours} hodin ({stats.totalHours > 0 ? ((stats.completedHours / stats.totalHours) * 100).toFixed(1) : 0}%)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Progress Overview Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-gray-900">Dokončené předměty</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">
                  {stats.completed} z {stats.total}
                </span>
                <span className="font-medium">{stats.completionRate.toFixed(1)}%</span>
              </div>
              <Progress value={stats.completionRate} className="h-2" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-gray-900">Zápočty</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">
                  {stats.creditsCompleted} z {stats.totalSubjectsWithCredits}
                </span>
                <span className="font-medium">{stats.creditCompletionRate.toFixed(1)}%</span>
              </div>
              <Progress value={stats.creditCompletionRate} className="h-2" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-gray-900">Zkoušky</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">
                  {stats.examsCompleted} z {stats.totalSubjectsWithExams}
                </span>
                <span className="font-medium">{stats.examCompletionRate.toFixed(1)}%</span>
              </div>
              <Progress value={stats.examCompletionRate} className="h-2" />
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}

// Simple statistics display for study detail view
function SimpleStatisticsCards({ stats }: { stats: StudyStatistics }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-gray-600">Celkem předmětů</CardTitle>
          <BookOpen className="h-4 w-4 text-primary-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
          <p className="text-xs text-gray-600 mt-1">
            Dokončeno: {stats.completed} ({stats.total > 0 ? ((stats.completed / stats.total) * 100).toFixed(1) : 0}%)
          </p>
        </CardContent>
      </Card>

      <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-gray-600">Dokončeno</CardTitle>
          <Calendar className="h-4 w-4 text-green-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-gray-900">{stats.completed}</div>
          <p className="text-xs text-gray-600 mt-1">z {stats.total} předmětů</p>
        </CardContent>
      </Card>

      <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-gray-600">Celkem kreditů</CardTitle>
          <Target className="h-4 w-4 text-indigo-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-gray-900">{stats.completedCredits}</div>
          <p className="text-xs text-gray-600 mt-1">z {stats.totalCredits} kreditů</p>
        </CardContent>
      </Card>

      {stats.average.type !== 'none' && (
        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">{stats.average.label}</CardTitle>
            <TrendingUp className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            {stats.average.type === 'both' ? (
              <div className="space-y-2">
                <div>
                  <div className="text-lg font-bold text-gray-900">
                    {stats.average.pointsValue ? stats.average.pointsValue.toFixed(2) : '-'}
                  </div>
                  <p className="text-xs text-gray-600">body (vážené kredity)</p>
                </div>
                <div>
                  <div className="text-lg font-bold text-gray-900">
                    {stats.average.gradeValue ? stats.average.gradeValue.toFixed(2) : '-'}
                  </div>
                  <p className="text-xs text-gray-600">známky (vážené kredity)</p>
                </div>
              </div>
            ) : (
              <div>
                <div className="text-2xl font-bold text-gray-900">
                  {stats.average.value ? stats.average.value.toFixed(2) : '-'}
                </div>
                <p className="text-xs text-gray-600 mt-1">průměr vážený kredity</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export { type StudyStatistics, type StatisticsSubject }
