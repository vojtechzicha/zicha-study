import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

export function useDepartments(studyId: string) {
  const [departments, setDepartments] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchDepartments() {
      const supabase = createClient()
      
      const { data, error } = await supabase
        .from("subjects")
        .select("department")
        .eq("study_id", studyId)
        .not("department", "is", null)
        .not("department", "eq", "")

      if (!error && data) {
        const uniqueDepartments = [...new Set(data.map(item => item.department).filter(Boolean))]
          .sort((a, b) => a.localeCompare(b, 'cs'))
        setDepartments(uniqueDepartments as string[])
      }
      
      setLoading(false)
    }

    if (studyId) {
      fetchDepartments()
    }
  }, [studyId])

  return { departments, loading }
}