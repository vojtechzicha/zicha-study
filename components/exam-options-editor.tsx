"use client"

import React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Trash2, Calendar, Clock, Monitor } from "lucide-react"
import { EXAM_DURATION_OPTIONS } from "@/lib/constants"

export interface ExamOptionData {
  id?: string
  date: string
  start_time: string
  duration_minutes: number
  is_online: boolean
  note: string
}

interface ExamOptionsEditorProps {
  options: ExamOptionData[]
  onChange: (_options: ExamOptionData[]) => void
  disabled?: boolean
}

export function ExamOptionsEditor({ options, onChange, disabled }: ExamOptionsEditorProps) {
  const addOption = () => {
    const newOption: ExamOptionData = {
      date: "",
      start_time: "09:00",
      duration_minutes: 120,
      is_online: false,
      note: "",
    }
    onChange([...options, newOption])
  }

  const removeOption = (index: number) => {
    const newOptions = options.filter((_, i) => i !== index)
    onChange(newOptions)
  }

  const updateOption = (index: number, field: keyof ExamOptionData, value: string | number | boolean) => {
    const newOptions = options.map((opt, i) => {
      if (i === index) {
        return { ...opt, [field]: value }
      }
      return opt
    })
    onChange(newOptions)
  }

  return (
    <div className="space-y-3">
      {options.length === 0 ? (
        <p className="text-sm text-gray-500 italic">Zatím nejsou přidány žádné termíny zkoušek.</p>
      ) : (
        <div className="space-y-3">
          {options.map((option, index) => (
            <div
              key={option.id || index}
              className="p-3 border rounded-lg bg-white space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Termín {index + 1}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeOption(index)}
                  disabled={disabled}
                  className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Datum
                  </Label>
                  <Input
                    type="date"
                    value={option.date}
                    onChange={(e) => updateOption(index, "date", e.target.value)}
                    disabled={disabled}
                    className="h-9"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Začátek
                  </Label>
                  <Input
                    type="time"
                    value={option.start_time}
                    onChange={(e) => updateOption(index, "start_time", e.target.value)}
                    disabled={disabled}
                    className="h-9"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Délka</Label>
                  <Select
                    value={option.duration_minutes.toString()}
                    onValueChange={(value) => updateOption(index, "duration_minutes", parseInt(value))}
                    disabled={disabled}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EXAM_DURATION_OPTIONS.map((dur) => (
                        <SelectItem key={dur.value} value={dur.value.toString()}>
                          {dur.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs flex items-center gap-1">
                    <Monitor className="h-3 w-3" />
                    Forma
                  </Label>
                  <div className="flex items-center h-9 px-2 border rounded-md bg-white">
                    <Checkbox
                      id={`online-${index}`}
                      checked={option.is_online}
                      onCheckedChange={(checked) => updateOption(index, "is_online", checked as boolean)}
                      disabled={disabled}
                      className="mr-2"
                    />
                    <Label htmlFor={`online-${index}`} className="text-sm cursor-pointer">
                      Online
                    </Label>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Poznámka</Label>
                <Input
                  value={option.note}
                  onChange={(e) => updateOption(index, "note", e.target.value)}
                  placeholder="volitelná poznámka k termínu"
                  disabled={disabled}
                  className="h-9"
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addOption}
        disabled={disabled}
        className="w-full border-dashed"
      >
        <Plus className="h-4 w-4 mr-2" />
        Přidat termín zkoušky
      </Button>
    </div>
  )
}
