"use client"

import type React from "react"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { ArrowLeft, Copy, ExternalLink, Save, AlertCircle, CheckCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface Study {
  id: string
  name: string
  type: string
  form: string
  start_year: number
  end_year?: number
  status: "active" | "completed" | "paused" | "abandoned"
  logo_url?: string
  slug?: string
  is_public?: boolean
  public_description?: string
  created_at: string
}

interface StudySettingsProps {
  study: Study
  onBack: () => void
  onSuccess: () => void
}

export function StudySettings({ study, onBack, onSuccess }: StudySettingsProps) {
  const [formData, setFormData] = useState({
    slug: study.slug || "",
    is_public: study.is_public || false,
    public_description: study.public_description || "",
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null)
  const [checkingSlug, setCheckingSlug] = useState(false)
  const supabase = createClient()

  const validateSlug = (slug: string) => {
    // Allow letters, numbers, hyphens, and underscores, 3-50 characters
    const slugRegex = /^[a-zA-Z0-9_-]{3,50}$/
    return slugRegex.test(slug)
  }

  const checkSlugAvailability = async (slug: string) => {
    if (!slug || !validateSlug(slug)) {
      setSlugAvailable(null)
      return
    }

    setCheckingSlug(true)
    try {
      const { data, error } = await supabase.from("studies").select("id").eq("slug", slug).neq("id", study.id).single()

      setSlugAvailable(!data)
    } catch (err) {
      setSlugAvailable(true) // If no results found, slug is available
    }
    setCheckingSlug(false)
  }

  const handleSlugChange = (value: string) => {
    // Convert to lowercase and replace spaces with hyphens
    const cleanSlug = value
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-zA-Z0-9_-]/g, "")
    setFormData({ ...formData, slug: cleanSlug })

    // Debounce slug checking
    setTimeout(() => checkSlugAvailability(cleanSlug), 500)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    setSuccess("")

    try {
      // Validate slug if public
      if (formData.is_public && formData.slug) {
        if (!validateSlug(formData.slug)) {
          throw new Error("Slug musí obsahovat pouze písmena, čísla, pomlčky a podtržítka (3-50 znaků)")
        }

        if (slugAvailable === false) {
          throw new Error("Tento slug již existuje, zvolte jiný")
        }
      }

      const updateData: any = {
        is_public: formData.is_public,
        public_description: formData.public_description || null,
      }

      // Only set slug if public and provided
      if (formData.is_public && formData.slug) {
        updateData.slug = formData.slug
      } else {
        updateData.slug = null
      }

      const { error } = await supabase.from("studies").update(updateData).eq("id", study.id)

      if (error) throw error

      setSuccess("Nastavení bylo úspěšně uloženo")
      setTimeout(() => {
        onSuccess()
      }, 1500)
    } catch (err: any) {
      setError(err.message || "Došlo k chybě při ukládání")
    } finally {
      setLoading(false)
    }
  }

  const copyPublicUrl = () => {
    if (formData.slug) {
      const url = `${window.location.origin}/public/${formData.slug}`
      navigator.clipboard.writeText(url)
      setSuccess("URL zkopírováno do schránky")
      setTimeout(() => setSuccess(""), 3000)
    }
  }

  const openPublicPage = () => {
    if (formData.slug) {
      window.open(`/public/${formData.slug}`, "_blank")
    }
  }

  const getSlugStatus = () => {
    if (!formData.slug) return null
    if (!validateSlug(formData.slug)) {
      return { type: "error", message: "Neplatný formát slug" }
    }
    if (checkingSlug) {
      return { type: "loading", message: "Kontroluji dostupnost..." }
    }
    if (slugAvailable === true) {
      return { type: "success", message: "Slug je dostupný" }
    }
    if (slugAvailable === false) {
      return { type: "error", message: "Slug již existuje" }
    }
    return null
  }

  const slugStatus = getSlugStatus()

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-white/20 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" onClick={onBack} className="text-gray-600 hover:text-gray-900">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Zpět
              </Button>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Nastavení sdílení</h1>
                <p className="text-sm text-gray-600">{study.name}</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Public Sharing Card */}
          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg font-bold text-gray-900">Veřejné sdílení</CardTitle>
              <p className="text-sm text-gray-600">
                Umožněte ostatním zobrazit váš studijní pokrok bez nutnosti přihlášení
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Enable Public Sharing */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base font-medium">Povolit veřejné sdílení</Label>
                  <p className="text-sm text-gray-600">Vaše studium bude dostupné na veřejné URL adrese</p>
                </div>
                <Switch
                  checked={formData.is_public}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_public: checked })}
                />
              </div>

              {/* Slug Configuration */}
              {formData.is_public && (
                <div className="space-y-4 pt-4 border-t border-gray-200">
                  <div className="space-y-2">
                    <Label htmlFor="slug" className="text-base font-medium">
                      URL adresa (slug)
                    </Label>
                    <p className="text-sm text-gray-600">
                      Zvolte krátkou a zapamatovatelnou URL adresu pro vaše studium
                    </p>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-500 bg-gray-100 px-3 py-2 rounded-l-md border border-r-0">
                        {window.location.origin}/public/
                      </span>
                      <Input
                        id="slug"
                        value={formData.slug}
                        onChange={(e) => handleSlugChange(e.target.value)}
                        placeholder="moje-studium"
                        className="rounded-l-none"
                        required={formData.is_public}
                      />
                    </div>
                    {slugStatus && (
                      <div className="flex items-center space-x-2 text-sm">
                        {slugStatus.type === "success" && <CheckCircle className="h-4 w-4 text-green-600" />}
                        {slugStatus.type === "error" && <AlertCircle className="h-4 w-4 text-red-600" />}
                        <span
                          className={
                            slugStatus.type === "success"
                              ? "text-green-600"
                              : slugStatus.type === "error"
                                ? "text-red-600"
                                : "text-gray-600"
                          }
                        >
                          {slugStatus.message}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Public Description */}
                  <div className="space-y-2">
                    <Label htmlFor="description" className="text-base font-medium">
                      Veřejný popis (volitelné)
                    </Label>
                    <p className="text-sm text-gray-600">Krátký popis, který se zobrazí na veřejné stránce</p>
                    <Textarea
                      id="description"
                      value={formData.public_description}
                      onChange={(e) => setFormData({ ...formData, public_description: e.target.value })}
                      placeholder="Můj pokrok ve studiu informatiky na VŠE..."
                      rows={3}
                    />
                  </div>

                  {/* URL Preview */}
                  {formData.slug && slugAvailable !== false && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-blue-900">Veřejná URL adresa:</p>
                          <p className="text-sm text-blue-700 font-mono break-all">
                            {window.location.origin}/public/{formData.slug}
                          </p>
                        </div>
                        <div className="flex space-x-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={copyPublicUrl}
                            className="text-blue-700 border-blue-300 hover:bg-blue-100 bg-transparent"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          {study.is_public && study.slug === formData.slug && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={openPublicPage}
                              className="text-blue-700 border-blue-300 hover:bg-blue-100 bg-transparent"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Privacy Notice */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Upozornění:</strong> Při povolení veřejného sdílení budou vaše studijní data (předměty, známky,
              statistiky) dostupné komukoli, kdo zná URL adresu. Osobní informace jako jméno a email zůstanou skryté.
            </AlertDescription>
          </Alert>

          {/* Error/Success Messages */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">{success}</AlertDescription>
            </Alert>
          )}

          {/* Submit Button */}
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={loading || (formData.is_public && (!formData.slug || slugAvailable === false))}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Save className="mr-2 h-4 w-4" />
              {loading ? "Ukládám..." : "Uložit nastavení"}
            </Button>
          </div>
        </form>
      </main>
    </div>
  )
}
