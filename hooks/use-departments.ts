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
        const deptValues = data.map((item: { department: string | null }) => item.department).filter((d: string | null): d is string => Boolean(d))
        const uniqueDepartments = Array.from(new Set<string>(deptValues)).sort((a: string, b: string) => a.localeCompare(b, 'cs'))
        setDepartments(uniqueDepartments)
      }
      
      setLoading(false)
    }

    if (studyId) {
      fetchDepartments()
    }
  }, [studyId])

  return { departments, loading }
}