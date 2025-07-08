"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ChevronRight, FolderOpen, AlertCircle } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { MaterialCard } from "@/components/material-card"
import { MaterialsTable } from "@/components/materials-table"
import type { Material } from "@/lib/types/materials"

interface Study {
  id: string
  name: string
  is_public?: boolean
  public_slug?: string
}

interface PublicMaterialsSectionProps {
  studyId: string
  study?: Study
}

export function PublicMaterialsSection({ studyId, study }: PublicMaterialsSectionProps) {
  const [materials, setMaterials] = useState<Material[]>([])
  const [loading, setLoading] = useState(true)
  const [showAll, setShowAll] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    const loadMaterials = async () => {
      setLoading(true)
      setError(null)
      
      try {
        const { data, error } = await supabase
          .from("materials")
          .select("*")
          .eq("study_id", studyId)
          .eq("is_public", true)
          .order("created_at", { ascending: false })

        if (error) throw error
        setMaterials(data || [])
      } catch (err) {
        setError("Nepodařilo se načíst materiály")
      } finally {
        setLoading(false)
      }
    }
    
    loadMaterials()
  }, [studyId, supabase])

  // Show only first 3 materials in preview mode
  const displayedMaterials = showAll ? materials : materials.slice(0, 3)

  if (materials.length === 0 && !loading) {
    return null // Don't show the section if there are no public materials
  }

  return (
    <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
      <CardHeader>
        <div>
          <CardTitle className="text-xl font-bold text-gray-900">Materiály</CardTitle>
          <p className="text-sm text-gray-600 mt-1">
            Veřejně dostupné dokumenty a soubory ke studiu
          </p>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : !showAll ? (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {displayedMaterials.map((material) => (
                <MaterialCard
                  key={material.id}
                  material={material}
                  studySlug={study?.public_slug}
                  isStudyPublic={study?.is_public}
                />
              ))}
            </div>
            {materials.length > 3 && (
              <div className="text-center pt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowAll(true)}
                  className="text-gray-700"
                >
                  Zobrazit všechny materiály ({materials.length})
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <Button
              variant="outline"
              onClick={() => setShowAll(false)}
              size="sm"
              className="mb-4"
            >
              Zobrazit méně
            </Button>
            <MaterialsTable
              materials={materials}
              loading={false}
              studySlug={study?.public_slug}
              isStudyPublic={study?.is_public}
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
}