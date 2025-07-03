"use client"

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Edit } from "lucide-react"
import { StudyLogo } from "@/components/study-logo"

interface Study {
  id: string
  name: string
  type: string
  form: string
  start_year: number
  end_year?: number
  status: "active" | "completed" | "paused" | "abandoned"
  logo_url?: string
  created_at: string
  is_public?: boolean
}

interface StudyCardProps {
  study: Study
  onSelect?: (study: Study) => void // click anywhere on the card
  onEdit?: (study: Study) => void // edit button click
}

function getStatusColor(status: Study["status"]) {
  switch (status) {
    case "active":
      return "bg-green-100 text-green-800 border-green-200"
    case "completed":
      return "bg-blue-100 text-blue-800 border-blue-200"
    case "paused":
      return "bg-yellow-100 text-yellow-800 border-yellow-200"
    case "abandoned":
      return "bg-red-100 text-red-800 border-red-200"
    default:
      return "bg-gray-100 text-gray-800 border-gray-200"
  }
}

export default function StudyCard({ study, onSelect, onEdit }: StudyCardProps) {
  return (
    <Card
      className="bg-white/80 backdrop-blur-sm border-0 shadow-lg hover:shadow-xl transition-all duration-200 cursor-pointer group relative"
      onClick={() => onSelect?.(study)}
    >
      <CardHeader>
        <div className="flex justify-between items-start">
          <div className="flex items-start gap-3 flex-1">
            <StudyLogo logoUrl={study.logo_url} studyName={study.name} size="lg" />
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg font-bold text-gray-900 group-hover:text-blue-600 transition-colors truncate">
                {study.name}
              </CardTitle>
              <CardDescription className="text-gray-600 truncate">
                {study.type} • {study.form}
              </CardDescription>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <Badge className={getStatusColor(study.status)}>{/* Czech labels handled elsewhere */ study.status}</Badge>

            {onEdit && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  onEdit(study)
                }}
                className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 p-0"
              >
                <Edit className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="text-sm text-gray-600">
          <p>Začátek: {study.start_year}</p>
          {study.end_year && <p>Konec: {study.end_year}</p>}
        </div>
      </CardContent>
    </Card>
  )
}
