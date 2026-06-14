import Anthropic from "@anthropic-ai/sdk"
import type { Curriculum, ParsedRepo } from "./types"
import { buildRepoSummary } from "./github"

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// Haiku-optimised prompt: very directive, concrete examples, zero ambiguity.
// Haiku follows explicit instructions extremely well — it just needs them spelled out.
const CURRICULUM_PROMPT = `You are a senior programming educator. Analyze the provided codebase and output a personalized learning curriculum as JSON.

MISSION: The learner built this project (possibly with AI) and wants to truly understand it. Every lesson must be grounded in THEIR actual code — file paths, function names, real snippets. No generic filler.

═══ OUTPUT FORMAT ═══
Return ONLY a valid JSON object. No markdown, no explanation, no code fences. Start with { and end with }.

Schema:
{
  "projectName": string,
  "techStack": { "framework": string, "language": string, "database": string|null, "auth": string|null, "styling": string|null, "deployment": string|null, "other": string[] },
  "difficulty": "beginner"|"intermediate"|"advanced",
  "summary": string,
  "estimatedHours": number,
  "modules": [{
    "id": "mod_1",
    "title": string,
    "description": string,
    "icon": string,
    "difficulty": "beginner"|"intermediate"|"advanced",
    "concepts": string[],
    "lessons": [{
      "id": "les_1_1",
      "title": string,
      "type": "explanation"|"challenge",
      "content": string,
      "codeReference": string|null,
      "codeSnippet": string|null,
      "challenge": { "question": string, "instructions": string, "starterCode": string, "solution": string, "hint": string, "xp": number }|null,
      "xp": number
    }],
    "totalXp": number
  }]
}

═══ CONTENT RULES ═══

LESSONS — "content" field:
- 3-5 paragraphs. Explain what this concept is, then show exactly how the learner used it in their project.
- Always name the specific file (e.g. "In your `auth.js`...") and quote actual code inline using backticks.
- Tone: "You built X — here's what it actually does and why it matters."
- NEVER include the challenge answer in the lesson content.

MODULES — aim for 5-7 modules, 2-3 lessons each. Progress from foundational → advanced.

═══ CHALLENGE RULES (read carefully) ═══

Every challenge must follow this formula:
  LESSON teaches concept using code from their project.
  CHALLENGE tests understanding by presenting a NEW scenario using the same concept.

The gap between explanation and challenge is what creates learning. If you can solve the challenge by copy-pasting from the explanation, it's too easy.

GOOD challenge anatomy:
  question: One sentence — what to accomplish, not how. ("Refactor this component to use the variable system.")
  instructions: 2-3 sentences — context only. Describe the GOAL and WHY, never the method or exact values.
  starterCode: Broken/incomplete code with a real problem to solve. NOT just a comment placeholder.
  solution: Complete working code, meaningfully different from starterCode.
  hint: One sentence steering toward the right approach without revealing it. ("Think about where CSS variables are declared vs where they're used.")
  xp: 25-75 based on difficulty.

BAD instructions (never do this): "Add the variable --gold: #f5a623 to :root and use it in .highlight"
GOOD instructions (do this): "Your color system uses CSS variables for theming. Add a new brand color that respects both light and dark mode, then wire it up to the highlight element."

═══ STACK DETECTION ═══
Only include technologies you actually see evidence of in the code. Do not guess or invent.`

export async function generateCurriculum(repo: ParsedRepo): Promise<Curriculum> {
  const repoSummary = buildRepoSummary(repo)

  const response = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 8000,
    messages: [
      {
        role: "user",
        content: `${CURRICULUM_PROMPT}\n\n=== REPOSITORY ===\n\n${repoSummary}`,
      },
    ],
  })

  const textBlock = response.content.find(b => b.type === "text")
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude returned no text content")
  }

  let raw = textBlock.text.trim()

  // Strip any accidental markdown fences
  if (raw.includes("```")) {
    const fenceMatch = raw.match(/```(?:json)?\n?([\s\S]*?)\n?```/)
    if (fenceMatch) raw = fenceMatch[1].trim()
  }

  // Extract outermost JSON object if surrounded by text
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
      `Failed to parse curriculum JSON. Try again — large repos occasionally hit this. Preview: ${raw.slice(0, 300)}`
    )
  }

  const totalXp = parsed.modules.reduce((sum, m) => sum + m.totalXp, 0)

  return {
    id: crypto.randomUUID(),
    projectUrl: `https://github.com/${repo.owner}/${repo.repo}`,
    totalXp,
    generatedAt: new Date().toISOString(),
    ...parsed,
  }
}
