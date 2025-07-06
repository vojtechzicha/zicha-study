"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Plus, FolderOpen, ChevronRight, AlertCircle } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { MaterialCard } from "@/components/material-card"
import { MaterialsTable } from "@/components/materials-table"
import { AddMaterialDialog } from "@/components/add-material-dialog"
import type { Material } from "@/lib/types/materials"

interface Study {
  id: string
  name: string
  is_public?: boolean
  public_slug?: string
}

interface MaterialsSectionProps {
  studyId: string
  study?: Study
}

export function MaterialsSection({ studyId, study }: MaterialsSectionProps) {
  const [materials, setMaterials] = useState<Material[]>([])
  const [loading, setLoading] = useState(true)
  const [showAll, setShowAll] = useState(false)
  const [showAddDialog, setShowAddDialog] = useState(false)
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

  const fetchMaterials = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const { data, error } = await supabase
        .from("materials")
        .select("*")
        .eq("study_id", studyId)
        .order("created_at", { ascending: false })

      if (error) throw error
      setMaterials(data || [])
    } catch (err) {
      setError("Nepodařilo se načíst materiály")
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (materialId: string) => {
    if (!confirm("Opravdu chcete odstranit tento materiál?")) {
      return
    }

    try {
      const { error } = await supabase
        .from("materials")
        .delete()
        .eq("id", materialId)

      if (error) throw error
      
      setMaterials(materials.filter(m => m.id !== materialId))
    } catch (err) {
      setError("Nepodařilo se odstranit materiál")
    }
  }

  const handleAddSuccess = () => {
    setShowAddDialog(false)
    fetchMaterials()
  }

  const handleMaterialUpdate = () => {
    fetchMaterials()
  }

  // Show only first 3 materials in preview mode
  const displayedMaterials = showAll ? materials : materials.slice(0, 3)

  return (
    <>
      <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-xl font-bold text-gray-900">Materiály</CardTitle>
              <p className="text-sm text-gray-600 mt-1">
                Dokumenty a soubory ke studiu
              </p>
            </div>
            <Button
              onClick={() => setShowAddDialog(true)}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white"
              size="sm"
            >
              <Plus className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Přidat materiál</span>
            </Button>
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
          ) : materials.length === 0 ? (
            <div className="text-center py-12">
              <FolderOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Zatím nejsou přidány žádné materiály
              </h3>
              <p className="text-gray-600 mb-6">
                Přidejte dokumenty z vašeho OneDrive
              </p>
              <Button
                onClick={() => setShowAddDialog(true)}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white"
              >
                <Plus className="mr-2 h-4 w-4" />
                Přidat první materiál
              </Button>
            </div>
          ) : !showAll ? (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {displayedMaterials.map((material) => (
                  <MaterialCard
                    key={material.id}
                    material={material}
                    onDelete={handleDelete}
                    onUpdate={handleMaterialUpdate}
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
                    Zobrazit všechny materiály
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
                onDelete={handleDelete}
                loading={false}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <AddMaterialDialog
        studyId={studyId}
        isOpen={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        onSuccess={handleAddSuccess}
      />
    </>
  )
}