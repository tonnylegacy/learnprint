import Anthropic from "@anthropic-ai/sdk"
import type { Curriculum, ParsedRepo } from "./types"
import { buildRepoSummary } from "./github"

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const CURRICULUM_PROMPT = `You are an expert programming educator. Your job is to analyze a real codebase and generate a personalized, step-by-step learning curriculum based on what the developer actually built.

The key philosophy: the learner built this project (possibly with AI help) and now wants to understand what they built. Every lesson must reference their ACTUAL code — not generic examples.

You will receive a repository summary. Analyze it and return a curriculum JSON object.

RULES:
- Extract what the dev actually used (don't invent tools they didn't use)
- Every lesson's codeSnippet must be real code from their files
- Lessons should teach progressively — start with the most foundational concepts
- The tone should be encouraging: "You built X — here's what it actually does"
- Be specific: reference actual file paths and function names from their code
- Group related concepts into modules (aim for 4-6 modules, 2-3 lessons each — keep it concise)
- Keep lesson content under 150 words each — quality over length
- Keep challenge instructions under 60 words each

CRITICAL — CHALLENGE DESIGN (this is the most important rule):
The explanation and the challenge must test DIFFERENT things. The explanation teaches the concept using their existing code. The challenge asks the user to APPLY that concept in a new, slightly different scenario they haven't seen yet.

BAD challenge (spoon-fed): Explanation shows how --bg and --text CSS variables work. Challenge says "add a --gold variable". The answer is obvious from reading the explanation.

GOOD challenge (requires thinking): Explanation shows how --bg and --text CSS variables work. Challenge presents a broken component that uses a hardcoded color value and asks the user to refactor it to use the variable system — a task that requires understanding, not copying.

Rules for every challenge:
1. The starterCode must have a REAL problem to solve — broken code, missing piece, or wrong approach — not just a comment saying "add X here"
2. The challenge scenario must be slightly different from the explanation example so the user can't just copy-paste
3. The hint should nudge toward the right approach without giving the answer
4. The solution should be meaningfully different from the starterCode (not just filling in one word)
5. Never put the answer inside the explanation content — teach the concept, don't give the solution
6. The "instructions" field must NEVER contain: exact variable names from the solution, specific values to copy, or step-by-step procedures that lead directly to the answer. Instructions should describe the GOAL and the CONTEXT, not the method. Bad: "Add --gold: #f5a623 to :root". Good: "Your site uses a color variable system. Add a brand accent color that works in both light and dark themes, then apply it to the .highlight element."
7. The "question" field should be a single clear sentence describing what to accomplish — not how to do it

Return ONLY valid JSON matching this exact TypeScript interface — no markdown, no explanation:

{
  "projectName": string,
  "techStack": {
    "framework": string,
    "language": string,
    "database": string | null,
    "auth": string | null,
    "styling": string | null,
    "deployment": string | null,
    "other": string[]
  },
  "difficulty": "beginner" | "intermediate" | "advanced",
  "summary": string, // 2 sentences: what the project does + what makes it interesting to learn from
  "estimatedHours": number,
  "modules": [
    {
      "id": "mod_1",
      "title": string,
      "description": string,
      "icon": string, // single emoji
      "difficulty": "beginner" | "intermediate" | "advanced",
      "concepts": string[], // e.g. ["supabase-auth", "rls-policies"]
      "lessons": [
        {
          "id": "les_1_1",
          "title": string,
          "type": "explanation" | "challenge",
          "content": string, // markdown — explain what this concept does IN THEIR PROJECT, reference specific code
          "codeReference": string | null, // file path like "app/auth/login/page.tsx"
          "codeSnippet": string | null, // actual code snippet from their project (max 20 lines)
          "challenge": {
            "question": string,
            "instructions": string,
            "starterCode": string,
            "solution": string,
            "hint": string,
            "xp": number
          } | null,
          "xp": number
        }
      ],
      "totalXp": number
    }
  ]
}`

export async function generateCurriculum(repo: ParsedRepo): Promise<Curriculum> {
  const repoSummary = buildRepoSummary(repo)

  const response = await client.messages.create({
    model: "claude-haiku-4-5",  // faster on Vercel Hobby 60s limit; sonnet for local dev
    max_tokens: 8000,
    // No thinking — this is structured JSON generation, not reasoning.
    // Thinking blocks consume token budget and leave nothing for the output.
    messages: [
      {
        role: "user",
        content: `${CURRICULUM_PROMPT}\n\n=== REPOSITORY TO ANALYZE ===\n\n${repoSummary}`,
      },
    ],
  })

  // Extract text from response
  const textBlock = response.content.find(b => b.type === "text")
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude returned no text content")
  }

  let raw = textBlock.text.trim()

  // Strip markdown code fences (```json ... ``` or ``` ... ```)
  if (raw.includes("```")) {
    const fenceMatch = raw.match(/```(?:json)?\n?([\s\S]*?)\n?```/)
    if (fenceMatch) raw = fenceMatch[1].trim()
  }

  // Find the outermost JSON object if there's surrounding text
  if (!raw.startsWith("{")) {
    const jsonStart = raw.indexOf("{")
    const jsonEnd = raw.lastIndexOf("}")
    if (jsonStart !== -1 && jsonEnd !== -1) {
      raw = raw.slice(jsonStart, jsonEnd + 1)
    }
  }

  let parsed: Omit<Curriculum, "id" | "projectUrl" | "totalXp" | "generatedAt">
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error(
      `Claude returned invalid JSON. This sometimes happens on very large repos — try again or use a smaller repo. Preview: ${raw.slice(0, 300)}`
    )
  }

  // Calculate totalXp
  const totalXp = parsed.modules.reduce((sum, m) => sum + m.totalXp, 0)

  const curriculum: Curriculum = {
    id: crypto.randomUUID(),
    projectUrl: `https://github.com/${repo.owner}/${repo.repo}`,
    totalXp,
    generatedAt: new Date().toISOString(),
    ...parsed,
  }

  return curriculum
}
