"use client"

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Edit } from "lucide-react"
import { StudyLogo } from "@/components/study-logo"
import { Study, getStatusColor, getStatusText } from "@/lib/status-utils"

interface StudyCardProps {
  study: Study
  onSelect?: (_study: Study) => void // click anywhere on the card
  onEdit?: (_study: Study) => void // edit button click
}


export default function StudyCard({ study, onSelect, onEdit }: StudyCardProps) {
  return (
    <Card
      className="bg-white/80 backdrop-blur-sm border-0 shadow-lg hover:shadow-xl transition-all duration-200 cursor-pointer group relative"
      onClick={() => onSelect?.(study)}
    >
      <CardHeader>
        <div className="flex justify-between items-start">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <StudyLogo logoUrl={study.logo_url} studyName={study.name} size="lg" />
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg font-bold text-gray-900 group-hover:text-primary-600 transition-colors leading-tight break-words">
                {study.name}
              </CardTitle>
              <CardDescription className="text-gray-600 text-sm mt-1">
                {study.type} • {study.form}
              </CardDescription>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <Badge className={getStatusColor(study.status)}>{getStatusText(study.status)}</Badge>

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
