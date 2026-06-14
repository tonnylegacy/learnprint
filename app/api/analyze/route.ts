import { NextRequest, NextResponse } from "next/server"
import { generateCurriculumFromSummary } from "@/lib/analyzer"

// Step 2 of 2: Claude analysis only — no GitHub fetch (~15-25s with Haiku)
export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const { repoSummary, repoMeta } = await req.json()

    if (!repoSummary) {
      return NextResponse.json({ error: "repoSummary is required" }, { status: 400 })
    }

    console.log(`[Learnprint] Generating curriculum for ${repoMeta?.owner}/${repoMeta?.repo}`)
    const curriculum = await generateCurriculumFromSummary(
      repoSummary,
      repoMeta?.owner ?? "local",
      repoMeta?.repo ?? "project"
    )

    return NextResponse.json({ curriculum, curriculumId: curriculum.id })
  } catch (error) {
    console.error("[Learnprint] Analyze error:", error)
    const message = error instanceof Error ? error.message : "Analysis failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
