import { NextRequest, NextResponse } from "next/server"
import { parseZipBuffer } from "@/lib/zip"
import { generateCurriculum } from "@/lib/analyzer"

export const maxDuration = 120

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get("file") as File | null
    const projectName = (formData.get("projectName") as string | null) ?? "My Project"

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 })
    }

    if (!file.name.endsWith(".zip")) {
      return NextResponse.json({ error: "Only .zip files are supported" }, { status: 400 })
    }

    const maxSize = 50 * 1024 * 1024 // 50MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: "File too large. Max 50MB." }, { status: 400 })
    }

    console.log(`[Learnprint] Parsing zip: ${file.name} (${(file.size / 1024).toFixed(0)}KB)`)
    const buffer = await file.arrayBuffer()
    const repo = await parseZipBuffer(buffer, projectName)

    console.log(`[Learnprint] Parsed ${repo.files.length} files from zip`)
    const curriculum = await generateCurriculum(repo)

    return NextResponse.json({ curriculum, curriculumId: curriculum.id })
  } catch (error) {
    console.error("[Learnprint] Zip analyze error:", error)
    const message = error instanceof Error ? error.message : "Analysis failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
