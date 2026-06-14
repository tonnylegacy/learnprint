"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import dynamic from "next/dynamic"
import type { Curriculum, Lesson } from "@/lib/types"
import { formatXp } from "@/lib/utils"

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false })

export default function LessonPage() {
  const params = useParams()
  const router = useRouter()
  const curriculumId = params.id as string
  const lessonId = params.lessonId as string

  const [curriculum, setCurriculum] = useState<Curriculum | null>(null)
  const [lesson, setLesson] = useState<Lesson | null>(null)
  const [moduleTitle, setModuleTitle] = useState("")
  const [code, setCode] = useState("")
  const [showSolution, setShowSolution] = useState(false)
  const [showHint, setShowHint] = useState(false)
  const [completed, setCompleted] = useState(false)
  const [xpEarned, setXpEarned] = useState(false)
  const [prevLesson, setPrevLesson] = useState<Lesson | null>(null)
  const [nextLesson, setNextLesson] = useState<Lesson | null>(null)

  useEffect(() => {
    const stored = sessionStorage.getItem(`curriculum_${curriculumId}`)
    if (!stored) return

    const c: Curriculum = JSON.parse(stored)
    setCurriculum(c)

    // Find lesson and its neighbors
    const allLessons = c.modules.flatMap(m => m.lessons.map(l => ({ ...l, moduleTitle: m.title })))
    const idx = allLessons.findIndex(l => l.id === lessonId)
    if (idx === -1) return

    const found = c.modules.flatMap(m => m.lessons).find(l => l.id === lessonId)
    const foundModule = c.modules.find(m => m.lessons.some(l => l.id === lessonId))
    if (!found || !foundModule) return

    setLesson(found)
    setModuleTitle(foundModule.title)
    setCode(found.challenge?.starterCode ?? "")
    setPrevLesson(idx > 0 ? allLessons[idx - 1] : null)
    setNextLesson(idx < allLessons.length - 1 ? allLessons[idx + 1] : null)

    // Check if already completed
    const progress: string[] = JSON.parse(localStorage.getItem(`progress_${curriculumId}`) ?? "[]")
    if (progress.includes(lessonId)) setCompleted(true)
  }, [curriculumId, lessonId])

  const markComplete = useCallback(() => {
    if (completed) return
    setCompleted(true)
    setXpEarned(true)

    // Persist progress
    const key = `progress_${curriculumId}`
    const existing: string[] = JSON.parse(localStorage.getItem(key) ?? "[]")
    if (!existing.includes(lessonId)) {
      localStorage.setItem(key, JSON.stringify([...existing, lessonId]))
    }

    // Hide XP badge after 3s
    setTimeout(() => setXpEarned(false), 3000)
  }, [completed, curriculumId, lessonId])

  if (!lesson || !curriculum) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
      </main>
    )
  }

  return (
    <main className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-white/5 px-6 py-4 flex items-center gap-4 sticky top-0 z-20 bg-[#0a0a0f]/90 backdrop-blur">
        <Link href={`/learn/${curriculumId}`} className="text-white/50 hover:text-white transition-colors text-sm">
          ← {curriculum.projectName}
        </Link>
        <span className="text-white/20">›</span>
        <span className="text-white/60 text-sm truncate">{moduleTitle}</span>
        <span className="text-white/20">›</span>
        <span className="text-white/80 text-sm font-medium truncate">{lesson.title}</span>

        <div className="ml-auto flex items-center gap-3">
          {completed ? (
            <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-semibold">
              ✓ Completed
            </span>
          ) : (
            <button
              onClick={markComplete}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all"
            >
              Mark Complete
            </button>
          )}
        </div>
      </header>

      {/* XP earned toast */}
      {xpEarned && (
        <div className="fixed top-20 right-6 z-50 px-5 py-3 rounded-xl bg-indigo-600 text-white font-bold text-sm shadow-xl xp-glow animate-bounce">
          🎉 +{lesson.xp} XP earned!
        </div>
      )}

      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Left: content */}
        <div className="flex-1 max-w-2xl px-8 py-10 overflow-y-auto">
          {/* Lesson header */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <span className="px-2.5 py-1 rounded-md bg-white/5 text-white/40 text-xs font-mono capitalize">
                {lesson.type}
              </span>
              <span className="text-indigo-400 text-xs font-semibold">+{lesson.xp} XP</span>
            </div>
            <h1 className="text-3xl font-black mb-4">{lesson.title}</h1>
            {lesson.codeReference && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/3 border border-white/8 w-fit">
                <span className="text-white/30 text-xs">📁</span>
                <code className="text-indigo-300 text-xs font-mono">{lesson.codeReference}</code>
              </div>
            )}
          </div>

          {/* Lesson content (markdown-ish) */}
          <div className="prose prose-invert prose-sm max-w-none mb-8">
            <div className="text-white/75 leading-relaxed space-y-4 whitespace-pre-wrap text-base">
              {lesson.content}
            </div>
          </div>

          {/* Code snippet from their project */}
          {lesson.codeSnippet && (
            <div className="mb-8">
              <p className="text-xs text-white/40 font-mono mb-2 flex items-center gap-2">
                <span>📎</span>
                <span>From your project: <code className="text-indigo-300">{lesson.codeReference}</code></span>
              </p>
              <div className="rounded-xl overflow-hidden border border-white/8">
                <MonacoEditor
                  height="200px"
                  language={getLanguage(lesson.codeReference ?? "")}
                  value={lesson.codeSnippet}
                  options={{
                    readOnly: true,
                    minimap: { enabled: false },
                    fontSize: 13,
                    lineNumbers: "on",
                    scrollBeyondLastLine: false,
                    wordWrap: "on",
                    theme: "vs-dark",
                    padding: { top: 12, bottom: 12 },
                    folding: false,
                  }}
                  theme="vs-dark"
                />
              </div>
            </div>
          )}

          {/* Challenge section */}
          {lesson.challenge && (
            <div className="border border-indigo-500/30 rounded-2xl overflow-hidden mb-8">
              <div className="px-6 py-4 bg-indigo-500/10 border-b border-indigo-500/20">
                <h2 className="font-bold text-indigo-300 flex items-center gap-2">
                  <span>🎯</span> Challenge — +{lesson.challenge.xp} XP
                </h2>
                <p className="text-white/80 mt-2 text-sm">{lesson.challenge.question}</p>
              </div>
              <div className="px-6 py-4">
                <p className="text-white/60 text-sm leading-relaxed mb-4">{lesson.challenge.instructions}</p>

                {/* Hint */}
                {!showHint ? (
                  <button
                    onClick={() => setShowHint(true)}
                    className="text-white/30 hover:text-white/60 text-sm transition-colors mb-4"
                  >
                    💡 Show hint
                  </button>
                ) : (
                  <div className="px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-sm mb-4">
                    💡 {lesson.challenge.hint}
                  </div>
                )}

                {/* Solution */}
                {!showSolution ? (
                  <button
                    onClick={() => setShowSolution(true)}
                    className="text-white/30 hover:text-white/60 text-sm transition-colors"
                  >
                    👁️ Reveal solution
                  </button>
                ) : (
                  <div className="rounded-xl overflow-hidden border border-emerald-500/20">
                    <p className="text-xs text-emerald-400/60 font-mono px-4 py-2 bg-emerald-500/5 border-b border-emerald-500/10">
                      ✅ Solution
                    </p>
                    <MonacoEditor
                      height="180px"
                      language="typescript"
                      value={lesson.challenge.solution}
                      options={{
                        readOnly: true,
                        minimap: { enabled: false },
                        fontSize: 13,
                        lineNumbers: "off",
                        scrollBeyondLastLine: false,
                        wordWrap: "on",
                        padding: { top: 12, bottom: 12 },
                      }}
                      theme="vs-dark"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between pt-6 border-t border-white/8">
            {prevLesson ? (
              <Link
                href={`/learn/${curriculumId}/lesson/${prevLesson.id}`}
                className="flex items-center gap-2 px-4 py-3 rounded-xl border border-white/8 hover:border-white/20 text-white/60 hover:text-white transition-all text-sm"
              >
                ← Previous
              </Link>
            ) : <div />}

            {!completed && (
              <button
                onClick={markComplete}
                className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition-all"
              >
                ✓ Complete lesson
              </button>
            )}

            {nextLesson ? (
              <Link
                href={`/learn/${curriculumId}/lesson/${nextLesson.id}`}
                className="flex items-center gap-2 px-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-all text-sm"
              >
                Next →
              </Link>
            ) : (
              <Link
                href={`/learn/${curriculumId}`}
                className="flex items-center gap-2 px-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-all text-sm"
              >
                All modules →
              </Link>
            )}
          </div>
        </div>

        {/* Right: code editor */}
        {lesson.challenge && (
          <div className="w-full lg:w-1/2 border-l border-white/5 flex flex-col">
            <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
              <span className="text-sm font-medium text-white/60">✏️ Your answer</span>
              <button
                onClick={() => setCode(lesson.challenge?.starterCode ?? "")}
                className="text-white/30 hover:text-white/60 text-xs transition-colors"
              >
                Reset
              </button>
            </div>
            <div className="flex-1">
              <MonacoEditor
                height="100%"
                language="typescript"
                value={code}
                onChange={v => setCode(v ?? "")}
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  lineNumbers: "on",
                  scrollBeyondLastLine: false,
                  wordWrap: "on",
                  padding: { top: 16, bottom: 16 },
                  suggestOnTriggerCharacters: true,
                }}
                theme="vs-dark"
              />
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

function getLanguage(path: string): string {
  if (path.endsWith(".tsx") || path.endsWith(".ts")) return "typescript"
  if (path.endsWith(".jsx") || path.endsWith(".js")) return "javascript"
  if (path.endsWith(".py")) return "python"
  if (path.endsWith(".css") || path.endsWith(".scss")) return "css"
  if (path.endsWith(".sql")) return "sql"
  if (path.endsWith(".json")) return "json"
  if (path.endsWith(".md") || path.endsWith(".mdx")) return "markdown"
  return "typescript"
}
