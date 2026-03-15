import { useEffect, useState } from "react"
import { fetchDepartments } from "@/lib/actions/subjects"

export function useDepartments(studyId: string) {
  const [departments, setDepartments] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadDepartments() {
      const depts = await fetchDepartments(studyId)
      setDepartments(depts)
      setLoading(false)
    }

    if (studyId) {
      loadDepartments()
    }
  }, [studyId])

  return { departments, loading }
}