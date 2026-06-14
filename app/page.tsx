"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

type Tab = "url" | "zip" | "github"

export default function HomePage() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>("url")
  const [url, setUrl] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [dragOver, setDragOver] = useState(false)
  const [user, setUser] = useState<{ email?: string; user_metadata?: { user_name?: string } } | null>(null)
  const [repos, setRepos] = useState<{ fullName: string; name: string; private: boolean; language: string; description: string }[]>([])
  const [reposLoading, setReposLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) setUser(session.user)
      // Capture token from existing session on page load
      if (session?.provider_token) {
        sessionStorage.setItem("gh_token", session.provider_token)
      }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
      // Capture token immediately on sign-in before it can disappear from session
      if (event === "SIGNED_IN" && session?.provider_token) {
        sessionStorage.setItem("gh_token", session.provider_token)
      }
      if (event === "SIGNED_OUT") {
        sessionStorage.removeItem("gh_token")
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  async function signInWithGitHub() {
    setError("")
    await supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: "repo read:user",
      },
    })
  }

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null)
    setRepos([])
  }

  async function loadRepos() {
    setReposLoading(true)
    setError("")
    try {
      // Use token captured at sign-in time (more reliable than re-reading session)
      const token = sessionStorage.getItem("gh_token")

      if (!token) {
        setError("GitHub token not found. Please sign out then sign in with GitHub again.")
        setReposLoading(false)
        return
      }

      const res = await fetch(
        "https://api.github.com/user/repos?sort=updated&per_page=50&visibility=all",
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
          },
        }
      )

      if (!res.ok) {
        if (res.status === 403) {
          setError("Missing 'repo' scope. In Supabase → Auth → GitHub provider → add 'repo' to Additional OAuth Scopes, then sign in again.")
        } else {
          setError(`GitHub error ${res.status}. Try signing out and back in.`)
        }
        return
      }

      const data = await res.json()
      setRepos(data.map((r: { full_name: string; name: string; private: boolean; updated_at: string; language: string; description: string }) => ({
        fullName: r.full_name,
        name: r.name,
        private: r.private,
        updatedAt: r.updated_at,
        language: r.language,
        description: r.description,
      })))
    } catch {
      setError("Failed to load repos. Check your connection and try again.")
    } finally {
      setReposLoading(false)
    }
  }

  useEffect(() => {
    if (tab === "github" && user && repos.length === 0) loadRepos()
  }, [tab, user])

  // ── URL submit ──
  async function handleUrlSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!url.trim()) return
    setError("")
    setLoading(true)
    sessionStorage.setItem("learnprint_url", url.trim())
    sessionStorage.setItem("learnprint_method", "url")
    router.push("/analyzing")
  }

  // ── ZIP submit ──
  async function handleZipSubmit(file: File) {
    setError("")
    setLoading(true)
    sessionStorage.setItem("learnprint_zip_name", file.name.replace(".zip", ""))
    sessionStorage.setItem("learnprint_method", "zip")

    // Store file in IndexedDB-friendly way via temp URL
    const objectUrl = URL.createObjectURL(file)
    sessionStorage.setItem("learnprint_zip_url", objectUrl)
    router.push("/analyzing")
  }

  function handleFileDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file?.name.endsWith(".zip")) handleZipSubmit(file)
    else setError("Please drop a .zip file")
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleZipSubmit(file)
  }

  // ── GitHub repo select ──
  function handleRepoSelect(fullName: string) {
    setLoading(true)
    sessionStorage.setItem("learnprint_url", `https://github.com/${fullName}`)
    sessionStorage.setItem("learnprint_method", "github_oauth")
    // gh_token already in sessionStorage from sign-in — analyzing page reads it directly
    router.push("/analyzing")
  }

  return (
    <main className="flex-1 flex flex-col min-h-screen">
      {/* Nav */}
      <nav className="border-b border-white/5 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🧬</span>
          <span className="font-bold text-lg tracking-tight gradient-text">Learnprint</span>
        </div>
        <div className="flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-3">
              <span className="text-white/50 text-sm">
                @{user.user_metadata?.user_name ?? user.email}
              </span>
              <button onClick={signOut} className="text-white/30 hover:text-white/60 text-sm transition-colors">
                Sign out
              </button>
            </div>
          ) : (
            <button
              onClick={signInWithGitHub}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-white/10 hover:border-white/20 text-white/60 hover:text-white text-sm transition-all"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
              </svg>
              Sign in with GitHub
            </button>
          )}
          <div className="text-sm text-white/30">Beta</div>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">
        <div className="max-w-3xl mx-auto space-y-8 w-full">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-400 text-sm font-medium">
            <span>✨</span>
            <span>AI-powered personalized learning</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-black leading-tight tracking-tight">
            Learn from<br />
            <span className="gradient-text">your own code</span>
          </h1>

          <p className="text-xl text-white/60 max-w-2xl mx-auto leading-relaxed">
            Upload your project and get a personalized step-by-step curriculum —
            using <em>your actual code</em> as the examples.
          </p>

          {/* Method tabs */}
          <div className="w-full max-w-2xl mx-auto">
            <div className="flex rounded-xl bg-white/5 border border-white/8 p-1 mb-4">
              {([
                { id: "url", icon: "🔗", label: "GitHub URL" },
                { id: "zip", icon: "📦", label: "Upload ZIP" },
                { id: "github", icon: "🐙", label: "Connect GitHub" },
              ] as { id: Tab; icon: string; label: string }[]).map(t => (
                <button
                  key={t.id}
                  onClick={() => { setTab(t.id); setError("") }}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    tab === t.id
                      ? "bg-indigo-600 text-white shadow-lg"
                      : "text-white/40 hover:text-white/70"
                  }`}
                >
                  <span>{t.icon}</span>
                  <span>{t.label}</span>
                </button>
              ))}
            </div>

            {/* ── Tab: GitHub URL ── */}
            {tab === "url" && (
              <form onSubmit={handleUrlSubmit} className="space-y-3">
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="url"
                    value={url}
                    onChange={e => setUrl(e.target.value)}
                    placeholder="https://github.com/yourname/your-project"
                    className="flex-1 px-5 py-4 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-indigo-500/50 transition-all text-base"
                    disabled={loading}
                  />
                  <button
                    type="submit"
                    disabled={loading || !url.trim()}
                    className="px-8 py-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold transition-all whitespace-nowrap"
                  >
                    {loading ? <Spinner /> : "Generate →"}
                  </button>
                </div>
                <p className="text-white/30 text-xs">
                  Public repos work instantly · For private repos{" "}
                  <button type="button" onClick={() => setTab("github")} className="text-indigo-400 hover:underline">
                    connect GitHub
                  </button>
                  {" "}or add a GITHUB_TOKEN to .env.local
                </p>
              </form>
            )}

            {/* ── Tab: ZIP upload ── */}
            {tab === "zip" && (
              <div className="space-y-3">
                <div
                  onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleFileDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`w-full py-12 rounded-xl border-2 border-dashed cursor-pointer transition-all text-center ${
                    dragOver
                      ? "border-indigo-500 bg-indigo-500/10"
                      : "border-white/15 hover:border-white/30 bg-white/3"
                  } ${loading ? "opacity-50 pointer-events-none" : ""}`}
                >
                  <div className="space-y-3">
                    <div className="text-4xl">{loading ? "⏳" : "📦"}</div>
                    {loading ? (
                      <p className="text-white/60 font-medium">Analyzing your project...</p>
                    ) : (
                      <>
                        <p className="text-white/70 font-medium">Drop your project ZIP here</p>
                        <p className="text-white/30 text-sm">or click to browse · max 50MB</p>
                      </>
                    )}
                  </div>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".zip"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <p className="text-white/30 text-xs text-center">
                  Works for any project — Next.js, Python, Vue, anything · No GitHub needed
                </p>
              </div>
            )}

            {/* ── Tab: Connect GitHub ── */}
            {tab === "github" && (
              <div className="space-y-4">
                {!user ? (
                  <div className="py-10 text-center space-y-4">
                    <p className="text-white/60">Sign in with GitHub to access your private repos</p>
                    <button
                      onClick={signInWithGitHub}
                      className="inline-flex items-center gap-3 px-8 py-4 rounded-xl bg-white text-black font-semibold hover:bg-white/90 transition-all"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
                      </svg>
                      Continue with GitHub
                    </button>
                    <p className="text-white/25 text-xs">Requests repo scope to access private repos</p>
                  </div>
                ) : reposLoading ? (
                  <div className="py-10 text-center">
                    <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-white/40 text-sm">Loading your repos...</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                    <p className="text-white/40 text-xs font-medium uppercase tracking-wider pb-1">
                      Your repositories
                    </p>
                    {repos.map(repo => (
                      <button
                        key={repo.fullName}
                        onClick={() => handleRepoSelect(repo.fullName)}
                        disabled={loading}
                        className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-white/8 bg-white/3 hover:border-indigo-500/40 hover:bg-indigo-500/5 transition-all text-left group disabled:opacity-50"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-white/80 font-medium text-sm truncate">{repo.name}</span>
                            {repo.private && (
                              <span className="px-1.5 py-0.5 rounded text-xs bg-amber-500/15 text-amber-400 flex-shrink-0">
                                🔒 private
                              </span>
                            )}
                          </div>
                          {repo.description && (
                            <p className="text-white/35 text-xs truncate">{repo.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                          {repo.language && (
                            <span className="text-white/30 text-xs">{repo.language}</span>
                          )}
                          <span className="text-white/20 group-hover:text-indigo-400 transition-colors text-sm">→</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="mt-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-left">
                {error}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="px-6 py-20 border-t border-white/5">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">How it works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { step: "01", icon: "🔗", title: "Add your project", desc: "GitHub URL, upload a ZIP, or connect your GitHub account for private repos." },
              { step: "02", icon: "🧠", title: "Claude analyzes your code", desc: "Reads your actual files, detects every tool and pattern, maps them into teachable concepts." },
              { step: "03", icon: "🎓", title: "Learn from your build", desc: "Step-by-step curriculum where every lesson uses YOUR code. Complete challenges, earn XP." },
            ].map(item => (
              <div key={item.step} className="p-6 rounded-2xl border border-white/8 bg-white/2 hover:border-indigo-500/30 transition-all">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-3xl">{item.icon}</span>
                  <span className="text-white/20 font-mono text-sm font-bold">{item.step}</span>
                </div>
                <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                <p className="text-white/50 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-white/5 px-6 py-8 text-center text-white/30 text-sm">
        <p>
          Built by{" "}
          <a href="https://github.com/tonnylegacy" className="text-indigo-400 hover:text-indigo-300 transition-colors">@tonnylegacy</a>
          {" "}·{" "}
          <span className="gradient-text font-semibold">Learnprint</span>
          {" "}· Powered by Claude AI
        </p>
      </footer>
    </main>
  )
}

function Spinner() {
  return (
    <span className="flex items-center gap-2">
      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      Analyzing...
    </span>
  )
}
