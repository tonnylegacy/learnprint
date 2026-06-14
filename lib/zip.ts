import JSZip from "jszip"
import type { ParsedRepo, RepoFile } from "./types"

const READABLE_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".py", ".rb", ".go", ".rs",
  ".css", ".scss", ".html", ".sql", ".prisma", ".graphql",
  ".json", ".yaml", ".yml", ".toml", ".md", ".mdx"
])

const SKIP_PATHS = [
  "node_modules", ".next", ".git", "dist", "build", ".vercel",
  "coverage", "__pycache__", ".venv", "venv", ".turbo", ".cache"
]

const MAX_FILE_SIZE = 50_000
const MAX_FILES = 60

function shouldSkip(path: string): boolean {
  return SKIP_PATHS.some(s => path.includes(s))
}

function isReadable(path: string): boolean {
  const ext = "." + path.split(".").pop()?.toLowerCase()
  const basename = path.split("/").pop() ?? ""
  const alwaysInclude = [
    "package.json", "tsconfig.json", "next.config.ts", "next.config.js",
    "tailwind.config.ts", "tailwind.config.js", ".env.example",
    "middleware.ts", "middleware.js", "requirements.txt", "pyproject.toml"
  ]
  if (alwaysInclude.includes(basename)) return true
  return READABLE_EXTENSIONS.has(ext)
}

// Strip the top-level folder that zips often contain (e.g. "my-project-main/src/..." → "src/...")
function stripTopFolder(path: string): string {
  const parts = path.split("/")
  if (parts.length > 1 && !parts[0].includes(".")) {
    return parts.slice(1).join("/")
  }
  return path
}

export async function parseZipBuffer(
  buffer: ArrayBuffer,
  projectName: string
): Promise<ParsedRepo> {
  const zip = await JSZip.loadAsync(buffer)

  const allEntries: { path: string; zipObj: JSZip.JSZipObject }[] = []

  zip.forEach((relativePath, zipObj) => {
    if (zipObj.dir) return
    const cleanPath = stripTopFolder(relativePath)
    if (!cleanPath || shouldSkip(cleanPath) || !isReadable(cleanPath)) return
    allEntries.push({ path: cleanPath, zipObj })
  })

  // Sort by likely importance (package.json first, then by depth)
  allEntries.sort((a, b) => {
    const aName = a.path.split("/").pop() ?? ""
    const bName = b.path.split("/").pop() ?? ""
    if (aName === "package.json") return -1
    if (bName === "package.json") return 1
    return a.path.split("/").length - b.path.split("/").length
  })

  const limited = allEntries.slice(0, MAX_FILES)

  const files: RepoFile[] = await Promise.all(
    limited.map(async ({ path, zipObj }) => {
      const content = await zipObj.async("string")
      return {
        path,
        content: content.slice(0, MAX_FILE_SIZE),
        size: content.length,
      }
    })
  )

  // Find package.json
  const pkgFile = files.find(f => f.path === "package.json")
  let packageJson: Record<string, unknown> | undefined
  if (pkgFile) {
    try { packageJson = JSON.parse(pkgFile.content) } catch { /* ignore */ }
  }

  // Infer repo name from package.json or provided name
  const repoName = (packageJson?.name as string) ?? projectName.toLowerCase().replace(/\s+/g, "-")

  return {
    owner: "local",
    repo: repoName,
    defaultBranch: "main",
    files,
    packageJson,
    fileTree: files.map(f => f.path),
  }
}
