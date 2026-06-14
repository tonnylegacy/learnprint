import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

// Returns the authenticated user's GitHub repos (public + private)
export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (cookiesToSet) => {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const providerToken = session.provider_token
    if (!providerToken) {
      return NextResponse.json({ error: "No GitHub token — please sign in with GitHub again" }, { status: 401 })
    }

    // Fetch repos from GitHub API (all repos including private)
    const page = req.nextUrl.searchParams.get("page") ?? "1"
    const res = await fetch(
      `https://api.github.com/user/repos?sort=updated&per_page=50&page=${page}&visibility=all`,
      {
        headers: {
          Authorization: `Bearer ${providerToken}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      }
    )

    if (!res.ok) {
      return NextResponse.json({ error: "GitHub API error" }, { status: res.status })
    }

    const repos = await res.json()
    return NextResponse.json({
      repos: repos.map((r: { full_name: string; name: string; private: boolean; updated_at: string; language: string; description: string }) => ({
        fullName: r.full_name,
        name: r.name,
        private: r.private,
        updatedAt: r.updated_at,
        language: r.language,
        description: r.description,
      }))
    })
  } catch (error) {
    console.error("[Learnprint] GitHub repos error:", error)
    return NextResponse.json({ error: "Failed to fetch repos" }, { status: 500 })
  }
}
