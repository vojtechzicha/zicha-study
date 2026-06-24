"use client"

import React, { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Calendar,
  Clock,
  Train,
  Home,
  Monitor,
  MapPin,
  Wallet,
  BedDouble,
  TrendingUp,
  Palmtree,
  Lock,
  Sparkles,
  AlertTriangle,
} from "lucide-react"
import type { ScheduleItem, GlobalScheduleResult, GlobalScheduleComparison } from "@/lib/exam-scheduler"

interface GlobalExamScheduleViewProps {
  comparison: GlobalScheduleComparison
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: "CZK",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatDate(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00`)
  return date.toLocaleDateString("cs-CZ", {
    weekday: "long",
    day: "numeric",
    month: "long",
  })
}

function getItemIcon(type: ScheduleItem["type"]) {
  switch (type) {
    case "travel_to":
      return <Train className="h-4 w-4" />
    case "travel_from":
      return <Home className="h-4 w-4" />
    case "accommodation":
      return <BedDouble className="h-4 w-4" />
    case "exam":
      return <Calendar className="h-4 w-4" />
  }
}

function getItemColor(type: ScheduleItem["type"], isOnline?: boolean) {
  switch (type) {
    case "travel_to":
    case "travel_from":
      return "bg-orange-100 text-orange-700 border-orange-200"
    case "accommodation":
      return "bg-purple-100 text-purple-700 border-purple-200"
    case "exam":
      return isOnline
        ? "bg-green-100 text-green-700 border-green-200"
        : "bg-primary-100 text-primary-700 border-primary-200"
  }
}

function groupItemsByDate(items: ScheduleItem[]): Map<string, ScheduleItem[]> {
  const map = new Map<string, ScheduleItem[]>()
  for (const item of items) {
    const existing = map.get(item.date) || []
    existing.push(item)
    map.set(item.date, existing)
  }
  return map
}

function ResultBody({ result }: { result: GlobalScheduleResult }) {
  if (result.error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="pt-6">
          <p className="text-red-700">{result.error}</p>
        </CardContent>
      </Card>
    )
  }

  const itemsByDate = groupItemsByDate(result.items)
  const sortedDates = Array.from(itemsByDate.keys()).sort()

  return (
    <div className="space-y-6">
      {/* Cost summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary-600" />
            Náklady celkem
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-primary-50 rounded-lg">
              <p className="text-2xl font-bold text-primary-700">{formatCurrency(result.totalCost)}</p>
              <p className="text-sm text-gray-600">Celkem</p>
            </div>
            <div className="text-center p-3 bg-orange-50 rounded-lg">
              <p className="text-xl font-semibold text-orange-700">{formatCurrency(result.breakdown.travelCost)}</p>
              <p className="text-sm text-gray-600">{result.breakdown.travelTrips} cest</p>
            </div>
            <div className="text-center p-3 bg-purple-50 rounded-lg">
              <p className="text-xl font-semibold text-purple-700">{formatCurrency(result.breakdown.accommodationCost)}</p>
              <p className="text-sm text-gray-600">{result.breakdown.accommodationNights} nocí</p>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <p className="text-xl font-semibold text-green-700">{result.breakdown.examCount}</p>
              <p className="text-sm text-gray-600">zkoušek</p>
            </div>
          </div>
          {result.breakdown.ptoDays > 0 && (
            <p className="mt-4 text-sm text-gray-600">
              Prezenční zkoušky v pracovní dny (vyžadují dovolenou):{" "}
              <span className="font-semibold text-gray-800">{result.breakdown.ptoDays}</span>
            </p>
          )}

          {/* Per-study breakdown */}
          {result.perStudy.length > 1 && (
            <div className="mt-4 space-y-2">
              {result.perStudy.map((s) => (
                <div key={s.studyId} className="flex items-center justify-between text-sm border-t pt-2">
                  <span className="font-medium text-gray-700">{s.studyName}</span>
                  <span className="text-gray-600">
                    {formatCurrency(s.totalCost)} · {s.examCount} zk. · {s.travelTrips} cest · {s.accommodationNights} nocí
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Unschedulable warnings */}
      {result.unschedulable.length > 0 && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-yellow-800">Nezařazené požadavky</p>
              <ul className="text-sm text-yellow-700 mt-1 list-disc list-inside">
                {result.unschedulable.map((u) => (
                  <li key={u.requirementId}>
                    {u.periodName} – {u.subjectName}: {u.reason}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {result.truncated && (
        <p className="text-sm text-amber-700">
          Prohledávání bylo zastaveno na limitu – zobrazené řešení je nejlepší nalezené, nemusí však být zcela optimální.
        </p>
      )}

      {/* Timeline */}
      {result.items.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary-600" />
              Rozvrh
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {sortedDates.map((date) => (
              <div key={date} className="border rounded-lg overflow-hidden">
                <div className="bg-gray-100 px-4 py-2 font-medium text-gray-700 flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  {formatDate(date)}
                </div>
                <div className="p-3 space-y-2">
                  {itemsByDate.get(date)?.map((item, idx) => (
                    <div
                      key={idx}
                      className={`flex items-center gap-3 p-3 rounded-lg border ${getItemColor(item.type, item.exam?.isOnline)}`}
                    >
                      <div className="flex-shrink-0">{getItemIcon(item.type)}</div>
                      <div className="flex-grow min-w-0">
                        {item.type === "exam" && item.exam ? (
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium">
                                [{item.exam.subject.shortcut}] {item.exam.subject.name}
                              </span>
                              {item.studyName && (
                                <Badge variant="outline" className="border-gray-300 text-gray-600">
                                  {item.studyName}
                                </Badge>
                              )}
                              {item.exam.isOnline && (
                                <Badge variant="secondary" className="bg-green-200 text-green-800">
                                  <Monitor className="h-3 w-3 mr-1" />
                                  Online
                                </Badge>
                              )}
                              {item.requiresPto && (
                                <Badge variant="secondary" className="bg-amber-200 text-amber-800">
                                  <Palmtree className="h-3 w-3 mr-1" />
                                  Dovolená
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-sm mt-1">
                              <Clock className="h-3 w-3" />
                              <span>
                                {item.startTime} - {item.endTime}
                              </span>
                              {item.exam.note && <span className="text-gray-500">• {item.exam.note}</span>}
                            </div>
                          </div>
                        ) : item.type === "travel_to" ? (
                          <div>
                            <span className="font-medium">Cesta do školy{item.studyName ? ` (${item.studyName})` : ""}</span>
                            <div className="flex items-center gap-2 text-sm mt-1">
                              <Clock className="h-3 w-3" />
                              <span>Odjezd v {item.startTime}</span>
                            </div>
                          </div>
                        ) : item.type === "travel_from" ? (
                          <div>
                            <span className="font-medium">Cesta domů{item.studyName ? ` (${item.studyName})` : ""}</span>
                            <div className="flex items-center gap-2 text-sm mt-1">
                              <Clock className="h-3 w-3" />
                              <span>Odjezd v {item.startTime}</span>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <span className="font-medium">Ubytování{item.studyName ? ` (${item.studyName})` : ""}</span>
                            <div className="flex items-center gap-2 text-sm mt-1">
                              <MapPin className="h-3 w-3" />
                              <span>Noc u školy</span>
                            </div>
                          </div>
                        )}
                      </div>
                      {item.cost > 0 && <div className="flex-shrink-0 font-medium">{formatCurrency(item.cost)}</div>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export function GlobalExamScheduleView({ comparison }: GlobalExamScheduleViewProps) {
  const { forced, optimal, hasLocks, savingsCost } = comparison
  const [view, setView] = useState<"forced" | "optimal">("forced")

  const showComparison = hasLocks && (savingsCost > 0 || optimal.score < forced.score)

  return (
    <div className="space-y-4">
      {/* Optimal-vs-forced banner */}
      {showComparison && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-3">
            <Sparkles className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-blue-900">
                Bez zamčených termínů by šel rozvrh levněji
                {savingsCost > 0 ? ` o ${formatCurrency(savingsCost)}` : ""}.
              </p>
              <p className="text-sm text-blue-700 mt-1">
                Závazný rozvrh respektuje vaše zamčené termíny ({formatCurrency(forced.totalCost)}). Optimální rozvrh
                ignoruje zámky ({formatCurrency(optimal.totalCost)}).
              </p>
              <div className="flex gap-2 mt-3">
                <Button
                  size="sm"
                  variant={view === "forced" ? "default" : "outline"}
                  onClick={() => setView("forced")}
                  className={view === "forced" ? "bg-primary-600 hover:bg-primary-700" : ""}
                >
                  <Lock className="h-3.5 w-3.5 mr-1.5" />
                  Závazný rozvrh
                </Button>
                <Button
                  size="sm"
                  variant={view === "optimal" ? "default" : "outline"}
                  onClick={() => setView("optimal")}
                  className={view === "optimal" ? "bg-primary-600 hover:bg-primary-700" : ""}
                >
                  <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                  Optimální rozvrh
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ResultBody result={showComparison && view === "optimal" ? optimal : forced} />
    </div>
  )
}
