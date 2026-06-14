import { NextRequest, NextResponse } from "next/server"
import { fetchRepo } from "@/lib/github"
import { buildRepoSummary } from "@/lib/github"

// Step 1 of 2: fetch the repo and return a compact summary (~5-15s)
export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const { githubUrl, githubToken } = await req.json()

    if (!githubUrl?.includes("github.com")) {
      return NextResponse.json({ error: "Valid GitHub URL required" }, { status: 400 })
    }

    const token = githubToken ?? process.env.GITHUB_TOKEN
    const repo = await fetchRepo(githubUrl, token).catch((err: Error) => {
      if (err.message.includes("401")) throw new Error("GitHub auth failed. Sign out and reconnect GitHub.")
      if (err.message.includes("404")) throw new Error("Repo not found. Private? Use the Connect GitHub tab.")
      if (err.message.includes("403")) throw new Error("GitHub rate limit hit. Sign in with GitHub to raise it.")
      throw err
    })

    const summary = buildRepoSummary(repo)

    return NextResponse.json({
      summary,
      meta: {
        owner: repo.owner,
        repo: repo.repo,
        fileCount: repo.files.length,
        techHint: repo.packageJson ? "node" : "other",
      },
    })
  } catch (error) {
    console.error("[prefetch]", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Fetch failed" },
      { status: 500 }
    )
  }
}
