import { NextRequest, NextResponse } from "next/server"
import { fetchRepo } from "@/lib/github"
import { generateCurriculum } from "@/lib/analyzer"
import { supabaseAdmin } from "@/lib/supabase"
import type { AnalyzeRequest } from "@/lib/types"

// Extend timeout to 120s — Claude analysis can take 30-60s on large repos
export const maxDuration = 120

export async function POST(req: NextRequest) {
  try {
    const body: AnalyzeRequest & { githubToken?: string } = await req.json()
    const { githubUrl, userId, githubToken } = body

    if (!githubUrl) {
      return NextResponse.json({ error: "GitHub URL is required" }, { status: 400 })
    }

    if (!githubUrl.includes("github.com")) {
      return NextResponse.json({ error: "Must be a valid GitHub URL" }, { status: 400 })
    }

    // 1. Fetch repository files
    console.log(`[Learnprint] Fetching repo: ${githubUrl}`)
    // Use OAuth token if provided (private repos via Connect GitHub), else fall back to env PAT
    const token = githubToken ?? process.env.GITHUB_TOKEN
    const repo = await fetchRepo(githubUrl, token).catch((err: Error) => {
      if (err.message.includes("401")) {
        throw new Error(
          "GitHub authentication failed. Try signing out and back in with GitHub, then select the repo again."
        )
      }
      if (err.message.includes("404")) {
        throw new Error(
          "Repo not found. If it's private, use the 'Connect GitHub' tab to sign in, or add a GITHUB_TOKEN to .env.local."
        )
      }
      if (err.message.includes("403") || err.message.includes("rate limit")) {
        throw new Error(
          "GitHub rate limit hit. Sign in with GitHub or add a GITHUB_TOKEN to .env.local."
        )
      }
      throw err
    })

    // 2. Generate curriculum with Claude
    console.log(`[Learnprint] Generating curriculum for ${repo.owner}/${repo.repo}`)
    const curriculum = await generateCurriculum(repo)

    // 3. Persist to Supabase (if user is logged in and admin client available)
    let curriculumId = curriculum.id
    if (userId && supabaseAdmin) {
      // Save project
      const { data: project, error: projError } = await supabaseAdmin
        .from("projects")
        .insert({
          user_id: userId,
          name: curriculum.projectName,
          github_url: githubUrl,
          owner: repo.owner,
          repo: repo.repo,
          tech_stack: curriculum.techStack,
        })
        .select("id")
        .single()

      if (projError) {
        console.error("[Learnprint] Project insert error:", projError)
      } else if (project) {
        // Save curriculum
        const lessonCount = curriculum.modules.reduce((s, m) => s + m.lessons.length, 0)
        const { data: saved, error: currError } = await supabaseAdmin
          .from("curricula")
          .insert({
            id: curriculumId,
            project_id: project.id,
            user_id: userId,
            data: curriculum,
            total_xp: curriculum.totalXp,
            module_count: curriculum.modules.length,
            lesson_count: lessonCount,
          })
          .select("id")
          .single()

        if (currError) console.error("[Learnprint] Curriculum insert error:", currError)
        else if (saved) curriculumId = saved.id
      }
    }

    return NextResponse.json({ curriculum, curriculumId })
  } catch (error) {
    console.error("[Learnprint] Analyze error:", error)
    const message = error instanceof Error ? error.message : "Analysis failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
