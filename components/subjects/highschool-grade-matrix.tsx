"use client"

import React from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  getGrade,
  hsGradeLabel,
  highSchoolGradeStyle,
  subjectAverage,
  periodAverage,
  type HighSchoolPeriod,
  type HighSchoolGrade,
} from "@/lib/highschool/grades"

export interface MatrixSubject {
  id: string
  name: string
  abbreviation?: string | null
  lecturer?: string | null
  grades?: HighSchoolGrade[] | null
}

interface HighSchoolGradeMatrixProps {
  subjects: MatrixSubject[]
  periods: HighSchoolPeriod[]
  /** Optional per-row actions (edit/delete) — supplied by the admin view only. */
  renderActions?: (_subject: MatrixSubject) => React.ReactNode
}

function GradeBadge({ grade }: { grade: string | null }) {
  if (!grade) return <span className="text-gray-300">–</span>
  const style = highSchoolGradeStyle(grade)
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className="inline-flex h-7 w-7 items-center justify-center rounded text-sm font-semibold border"
            style={style ?? undefined}
          >
            {grade}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>{hsGradeLabel(grade)}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

function formatAverage(value: number | null): string {
  return value === null ? "–" : value.toFixed(2)
}

export function HighSchoolGradeMatrix({ subjects, periods, renderActions }: HighSchoolGradeMatrixProps) {
  if (subjects.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Zatím nebyly přidány žádné předměty.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[180px] sticky left-0 bg-white/90 backdrop-blur-sm">Předmět</TableHead>
            {periods.map((period) => (
              <TableHead key={period.key} className="text-center whitespace-nowrap w-[56px]">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>{period.shortLabel}</span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{period.label}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </TableHead>
            ))}
            <TableHead className="text-center w-[70px]">Ø</TableHead>
            {renderActions && <TableHead className="w-[100px] text-right">Akce</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {subjects.map((subject) => (
            <TableRow key={subject.id} className="hover:bg-primary-50">
              <TableCell className="sticky left-0 bg-white/90 backdrop-blur-sm">
                <div className="font-medium text-sm">
                  {subject.abbreviation ? (
                    <span className="font-mono text-xs text-gray-500 mr-2">{subject.abbreviation}</span>
                  ) : null}
                  {subject.name}
                </div>
                {subject.lecturer && (
                  <div className="text-xs text-gray-500 mt-0.5">{subject.lecturer}</div>
                )}
              </TableCell>
              {periods.map((period) => (
                <TableCell key={period.key} className="text-center">
                  <GradeBadge grade={getGrade(subject, period.year, period.half)} />
                </TableCell>
              ))}
              <TableCell className="text-center font-semibold text-gray-700">
                {formatAverage(subjectAverage(subject))}
              </TableCell>
              {renderActions && (
                <TableCell className="text-right">{renderActions(subject)}</TableCell>
              )}
            </TableRow>
          ))}

          {/* Per-pololetí averages */}
          <TableRow className="border-t-2 bg-primary-50/50 font-medium">
            <TableCell className="sticky left-0 bg-primary-50/90 backdrop-blur-sm text-sm text-gray-700">
              Průměr pololetí
            </TableCell>
            {periods.map((period) => (
              <TableCell key={period.key} className="text-center text-sm text-gray-700">
                {formatAverage(periodAverage(subjects, period.year, period.half))}
              </TableCell>
            ))}
            <TableCell />
            {renderActions && <TableCell />}
          </TableRow>
        </TableBody>
      </Table>
    </div>
  )
}
