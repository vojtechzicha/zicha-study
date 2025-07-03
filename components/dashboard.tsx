"use client"

import { useEffect, useState } from "react"
import { useUser, useSupabaseClient } from "@supabase/auth-helpers-react"
import type { Study } from "@/types"
import StudyCard from "./study-card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"

const Dashboard = () => {
  const [studies, setStudies] = useState<Study[]>([])
  const supabase = useSupabaseClient()
  const user = useUser()

  useEffect(() => {
    if (user) {
      fetchStudies()
    }
  }, [user])

  const fetchStudies = async () => {
    if (!user) return

    const { data, error } = await supabase
      .from("studies")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching studies:", error)
    } else {
      setStudies(data || [])
    }
  }

  return (
    <div className="container py-10">
      <div className="flex justify-between items-center mb-5">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Link href="/create">
          <Button>Create New Study</Button>
        </Link>
      </div>
      {studies.length === 0 ? (
        <p>No studies found. Create one to get started!</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {studies.map((study) => (
            <div key={study.id}>
              <StudyCard study={study} onUpdate={fetchStudies} />
              {study.is_public && (
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                  Veřejné
                </Badge>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default Dashboard
export { Dashboard }
