"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import type { Curriculum, Module } from "@/lib/types"
import { getDifficultyColor, formatXp } from "@/lib/utils"

export default function CurriculumPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const [curriculum, setCurriculum] = useState<Curriculum | null>(null)
  const [completedLessons, setCompletedLessons] = useState<Set<string>>(new Set())

  useEffect(() => {
    const stored = sessionStorage.getItem(`curriculum_${id}`)
    if (stored) {
      setCurriculum(JSON.parse(stored))
    }
    const progressKey = `progress_${id}`
    const progress = localStorage.getItem(progressKey)
    if (progress) setCompletedLessons(new Set(JSON.parse(progress)))
  }, [id])

  if (!curriculum) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white/40">Loading curriculum...</p>
        </div>
      </main>
    )
  }

  const totalLessons = curriculum.modules.reduce((s, m) => s + m.lessons.length, 0)
  const completedCount = completedLessons.size
  const progressPercent = Math.round((completedCount / totalLessons) * 100)
  const earnedXp = curriculum.modules.flatMap(m => m.lessons).filter(l => completedLessons.has(l.id)).reduce((s, l) => s + l.xp, 0)

  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="border-b border-white/5 px-6 py-4 flex items-center justify-between sticky top-0 z-10 bg-[#0a0a0f]/90 backdrop-blur">
        <Link href="/" className="flex items-center gap-2 text-white/60 hover:text-white transition-colors text-sm">
          ← Back
        </Link>
        <div className="flex items-center gap-2">
          <span className="text-lg">🧬</span>
          <span className="font-bold gradient-text">Learnprint</span>
        </div>
        <div className="text-sm text-indigo-400 font-semibold">
          {formatXp(earnedXp)} / {formatXp(curriculum.totalXp)} XP
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Project hero */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getDifficultyColor(curriculum.difficulty)}`}>
              {curriculum.difficulty}
            </span>
            <span className="text-white/30 text-sm">{curriculum.estimatedHours}h estimated</span>
            <span className="text-white/30 text-sm">·</span>
            <span className="text-white/30 text-sm">{totalLessons} lessons</span>
          </div>

          <h1 className="text-4xl font-black mb-3">{curriculum.projectName}</h1>
          <p className="text-white/60 text-lg leading-relaxed mb-4">{curriculum.summary}</p>

          {/* Tech stack pills */}
          <div className="flex flex-wrap gap-2 mb-6">
            <span className="px-3 py-1.5 rounded-lg bg-white/5 text-white/60 text-sm font-medium">
              {curriculum.techStack.framework}
            </span>
            <span className="px-3 py-1.5 rounded-lg bg-white/5 text-white/60 text-sm font-medium">
              {curriculum.techStack.language}
            </span>
            {curriculum.techStack.database && (
              <span className="px-3 py-1.5 rounded-lg bg-white/5 text-white/60 text-sm font-medium">
                {curriculum.techStack.database}
              </span>
            )}
            {curriculum.techStack.auth && (
              <span className="px-3 py-1.5 rounded-lg bg-white/5 text-white/60 text-sm font-medium">
                {curriculum.techStack.auth}
              </span>
            )}
            {curriculum.techStack.other.slice(0, 3).map(t => (
              <span key={t} className="px-3 py-1.5 rounded-lg bg-white/5 text-white/60 text-sm font-medium">{t}</span>
            ))}
          </div>

          {/* Overall progress bar */}
          <div className="p-5 rounded-2xl border border-white/8 bg-white/3">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold">Your Progress</span>
              <span className="text-sm text-white/50">{completedCount} / {totalLessons} lessons</span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all duration-700"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="text-white/30 text-xs mt-2">{progressPercent}% complete</p>
          </div>
        </div>

        {/* Modules */}
        <div className="space-y-6">
          <h2 className="text-2xl font-bold">Your Curriculum</h2>
          {curriculum.modules.map((module, moduleIndex) => (
            <ModuleCard
              key={module.id}
              module={module}
              moduleIndex={moduleIndex}
              curriculumId={id}
              completedLessons={completedLessons}
            />
          ))}
        </div>

        {/* GitHub link */}
        <div className="mt-12 pt-8 border-t border-white/5 text-center">
          <a
            href={curriculum.projectUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-white/30 hover:text-white/60 text-sm transition-colors"
          >
            📦 View original project on GitHub →
          </a>
        </div>
      </div>
    </main>
  )
}

function ModuleCard({
  module,
  moduleIndex,
  curriculumId,
  completedLessons,
}: {
  module: Module
  moduleIndex: number
  curriculumId: string
  completedLessons: Set<string>
}) {
  const completedInModule = module.lessons.filter(l => completedLessons.has(l.id)).length
  const allDone = completedInModule === module.lessons.length

  return (
    <div className={`rounded-2xl border transition-all ${allDone ? "border-emerald-500/30 bg-emerald-500/5" : "border-white/8 bg-white/2"}`}>
      {/* Module header */}
      <div className="p-6 border-b border-white/5">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center text-2xl flex-shrink-0">
            {module.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <span className="text-white/30 text-xs font-mono">Module {moduleIndex + 1}</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getDifficultyColor(module.difficulty)}`}>
                {module.difficulty}
              </span>
            </div>
            <h3 className="text-lg font-bold">{module.title}</h3>
            <p className="text-white/50 text-sm mt-1">{module.description}</p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-indigo-400 font-bold text-sm">{formatXp(module.totalXp)} XP</p>
            <p className="text-white/30 text-xs">{completedInModule}/{module.lessons.length} done</p>
          </div>
        </div>

        {/* Concepts */}
        <div className="flex flex-wrap gap-2 mt-4">
          {module.concepts.map(c => (
            <span key={c} className="px-2 py-1 rounded-md bg-white/5 text-white/40 text-xs font-mono">{c}</span>
          ))}
        </div>
      </div>

      {/* Lessons list */}
      <div className="divide-y divide-white/5">
        {module.lessons.map((lesson, lessonIndex) => {
          const done = completedLessons.has(lesson.id)
          return (
            <Link
              key={lesson.id}
              href={`/learn/${curriculumId}/lesson/${lesson.id}`}
              className="flex items-center gap-4 px-6 py-4 hover:bg-white/3 transition-colors group"
            >
              {/* Status icon */}
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold transition-all ${done ? "bg-emerald-500/20 text-emerald-400" : "bg-white/5 text-white/30 group-hover:bg-indigo-500/20 group-hover:text-indigo-400"}`}>
                {done ? "✓" : lessonIndex + 1}
              </div>
              {/* Lesson info */}
              <div className="flex-1 min-w-0">
                <p className={`font-medium text-sm ${done ? "text-white/50 line-through" : "text-white/80 group-hover:text-white"} transition-colors truncate`}>
                  {lesson.title}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-white/30 text-xs capitalize">{lesson.type}</span>
                  {lesson.codeReference && (
                    <>
                      <span className="text-white/20 text-xs">·</span>
                      <span className="text-white/20 text-xs font-mono truncate">{lesson.codeReference}</span>
                    </>
                  )}
                </div>
              </div>
              {/* XP */}
              <span className={`text-xs font-semibold flex-shrink-0 ${done ? "text-emerald-500" : "text-indigo-400"}`}>
                +{lesson.xp} XP
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
