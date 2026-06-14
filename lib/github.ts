import type { ParsedRepo, RepoFile } from "./types"

// Files we actually want to read (skip binaries, lock files, etc.)
const READABLE_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".py", ".rb", ".go", ".rs",
  ".css", ".scss", ".html", ".sql", ".prisma", ".graphql",
  ".json", ".yaml", ".yml", ".toml", ".env.example",
  ".md", ".mdx"
])

const SKIP_PATHS = [
  "node_modules", ".next", ".git", "dist", "build", ".vercel",
  "coverage", "__pycache__", ".venv", "venv", ".pytest_cache",
  "package-lock.json", "yarn.lock", "pnpm-lock.yaml", "bun.lockb"
]

const MAX_FILE_SIZE = 50_000  // 50KB per file
const MAX_FILES = 60           // cap total files read

function shouldSkip(path: string): boolean {
  return SKIP_PATHS.some(skip => path.includes(skip))
}

function isReadable(path: string): boolean {
  const ext = "." + path.split(".").pop()?.toLowerCase()
  const basename = path.split("/").pop() ?? ""
  // always include package.json, tsconfig, next.config, supabase config
  const alwaysInclude = [
    "package.json", "tsconfig.json", "next.config.ts", "next.config.js",
    "tailwind.config.ts", "tailwind.config.js", "supabase.ts", "supabase.js",
    ".env.example", "middleware.ts", "middleware.js"
  ]
  if (alwaysInclude.includes(basename)) return true
  return READABLE_EXTENSIONS.has(ext)
}

export function parseGithubUrl(url: string): { owner: string; repo: string } | null {
  try {
    const clean = url.replace(/\.git$/, "").replace(/\/$/, "")
    const match = clean.match(/github\.com\/([^/]+)\/([^/]+)/)
    if (!match) return null
    return { owner: match[1], repo: match[2] }
  } catch {
    return null
  }
}

export async function fetchRepo(
  githubUrl: string,
  token?: string
): Promise<ParsedRepo> {
  const parsed = parseGithubUrl(githubUrl)
  if (!parsed) throw new Error("Invalid GitHub URL")

  const { owner, repo } = parsed
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  }
  if (token) headers["Authorization"] = `Bearer ${token}`

  // 1. Get default branch
  const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers })
  if (!repoRes.ok) throw new Error(`GitHub API error: ${repoRes.status} — repo not found or private`)
  const repoData = await repoRes.json()
  const defaultBranch: string = repoData.default_branch ?? "main"

  // 2. Get full file tree (recursive)
  const treeRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`,
    { headers }
  )
  if (!treeRes.ok) throw new Error(`GitHub API error: ${treeRes.status} — could not fetch tree`)
  const treeData = await treeRes.json()

  const allFiles: { path: string; size: number }[] = (treeData.tree ?? [])
    .filter((f: { type: string; path: string; size: number }) => f.type === "blob")
    .filter((f: { path: string }) => !shouldSkip(f.path) && isReadable(f.path))
    .sort((a: { size: number }, b: { size: number }) => a.size - b.size) // smallest first
    .slice(0, MAX_FILES)

  // 3. Fetch file contents in parallel (batches of 10)
  const files: RepoFile[] = []
  const batches = chunk(allFiles, 10)

  for (const batch of batches) {
    const results = await Promise.allSettled(
      batch.map(async (f) => {
        if (f.size > MAX_FILE_SIZE) return null
        const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${defaultBranch}/${f.path}`
        const res = await fetch(rawUrl, { headers })
        if (!res.ok) return null
        const content = await res.text()
        return { path: f.path, content, size: f.size } as RepoFile
      })
    )
    for (const r of results) {
      if (r.status === "fulfilled" && r.value) files.push(r.value)
    }
  }

  // 4. Find package.json
  const pkgFile = files.find(f => f.path === "package.json")
  let packageJson: Record<string, unknown> | undefined
  if (pkgFile) {
    try { packageJson = JSON.parse(pkgFile.content) } catch { /* ignore */ }
  }

  return {
    owner,
    repo,
    defaultBranch,
    files,
    packageJson,
    fileTree: allFiles.map(f => f.path),
  }
}

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size))
  return chunks
}

// Build a compact summary of the repo for Claude (not full file contents)
export function buildRepoSummary(repo: ParsedRepo): string {
  const lines: string[] = [
    `Repository: ${repo.owner}/${repo.repo}`,
    `Default branch: ${repo.defaultBranch}`,
    ``,
    `=== FILE TREE (${repo.fileTree.length} files) ===`,
    repo.fileTree.join("\n"),
    ``,
    `=== KEY FILE CONTENTS ===`,
  ]

  // Priority files to always include in full
  const priority = ["package.json", "tsconfig.json", "next.config.ts", "next.config.js",
    "tailwind.config.ts", "middleware.ts", "middleware.js"]

  for (const p of priority) {
    const f = repo.files.find(f => f.path === p || f.path.endsWith("/" + p))
    if (f) {
      lines.push(`--- ${f.path} ---`)
      lines.push(f.content.slice(0, 3000))
      lines.push("")
    }
  }

  // Remaining files (truncated)
  const rest = repo.files.filter(f => !priority.some(p => f.path === p || f.path.endsWith("/" + p)))
  for (const f of rest.slice(0, 40)) {
    lines.push(`--- ${f.path} ---`)
    lines.push(f.content.slice(0, 1500))
    lines.push("")
  }

  return lines.join("\n")
}
