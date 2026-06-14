"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import type { Curriculum } from "@/lib/types"
import { supabase } from "@/lib/supabase"

const STEPS = [
  { icon: "🔍", text: "Reading repository files..." },
  { icon: "🗂️", text: "Mapping your file structure..." },
  { icon: "⚡", text: "Detecting your tech stack..." },
  { icon: "🧠", text: "Claude is analyzing your code..." },
  { icon: "📚", text: "Building your personalized curriculum..." },
  { icon: "🏆", text: "Creating challenges from your code..." },
  { icon: "✨", text: "Almost ready..." },
]

export default function AnalyzingPage() {
  const router = useRouter()
  const [stepIndex, setStepIndex] = useState(0)
  const [error, setError] = useState("")
  const [dots, setDots] = useState("")

  useEffect(() => {
    const dotsInterval = setInterval(() => {
      setDots(d => d.length >= 3 ? "" : d + ".")
    }, 400)

    const stepsInterval = setInterval(() => {
      setStepIndex(i => Math.min(i + 1, STEPS.length - 1))
    }, 4000)

    const method = sessionStorage.getItem("learnprint_method") ?? "url"
    const githubUrl = sessionStorage.getItem("learnprint_url")
    const zipUrl = sessionStorage.getItem("learnprint_zip_url")
    const zipName = sessionStorage.getItem("learnprint_zip_name") ?? "My Project"

    if (method === "zip" && !zipUrl) { router.push("/"); return }
    if (method !== "zip" && !githubUrl) { router.push("/"); return }

    async function analyze() {
      let res: Response

      if (method === "zip" && zipUrl) {
        // Fetch the object URL blob and send as FormData
        const blob = await fetch(zipUrl).then(r => r.blob())
        const formData = new FormData()
        formData.append("file", blob, `${zipName}.zip`)
        formData.append("projectName", zipName)
        res = await fetch("/api/analyze-zip", { method: "POST", body: formData })
        URL.revokeObjectURL(zipUrl)
        sessionStorage.removeItem("learnprint_zip_url")
        sessionStorage.removeItem("learnprint_zip_name")
      } else {
        // For GitHub OAuth repos, use the token captured at sign-in time
        let githubToken: string | undefined
        if (method === "github_oauth") {
          githubToken = sessionStorage.getItem("gh_token") ?? undefined
          if (!githubToken) {
            setError("GitHub token expired. Go back and sign in with GitHub again.")
            return
          }
        }

        res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ githubUrl, githubToken }),
        })
      }

      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? "Analysis failed. Please try again.")
        return
      }

      const { curriculum, curriculumId }: { curriculum: Curriculum; curriculumId: string } = await res.json()

      // Store curriculum in sessionStorage for the learn page
      sessionStorage.setItem(`curriculum_${curriculumId}`, JSON.stringify(curriculum))
      sessionStorage.removeItem("learnprint_url")
      sessionStorage.removeItem("learnprint_method")

      router.push(`/learn/${curriculumId}`)
    }

    analyze().catch(err => {
      console.error(err)
      setError("Something went wrong. Check your GitHub URL and try again.")
    })

    return () => {
      clearInterval(dotsInterval)
      clearInterval(stepsInterval)
    }
  }, [router])

  if (error) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <div className="text-5xl mb-6">❌</div>
        <h1 className="text-2xl font-bold mb-3">Analysis failed</h1>
        <p className="text-white/50 max-w-md mb-8">{error}</p>
        <button
          type="button"
          onClick={() => router.push("/")}
          className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-all"
        >
          Try again
        </button>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      {/* Logo */}
      <div className="mb-12">
        <span className="text-4xl">🧬</span>
        <p className="gradient-text font-bold text-xl mt-2">Learnprint</p>
      </div>

      {/* Spinner */}
      <div className="w-20 h-20 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin mb-10" />

      {/* Current step */}
      <div className="space-y-2 mb-8">
        <p className="text-white/30 text-sm font-mono">
          Step {stepIndex + 1} of {STEPS.length}
        </p>
        <p className="text-xl font-semibold text-white/80">
          {STEPS[stepIndex].icon} {STEPS[stepIndex].text}{dots}
        </p>
      </div>

      {/* Progress bar */}
      <div className="w-64 h-1.5 bg-white/10 rounded-full overflow-hidden">
        {/* eslint-disable-next-line react/forbid-component-props -- dynamic width needs inline style */}
        <div
          className="h-full bg-indigo-500 rounded-full transition-all duration-1000"
          style={{ width: `${((stepIndex + 1) / STEPS.length) * 100}%` }}
        />
      </div>

      <p className="mt-8 text-white/30 text-sm max-w-xs">
        Claude is reading your actual code files and building lessons specifically around what you built.
      </p>
    </main>
  )
}
