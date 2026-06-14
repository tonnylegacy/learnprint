import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { userCode, solution, lessonTitle, concept } = await req.json()

    if (!userCode?.trim()) {
      return NextResponse.json({ feedback: "Write some code first, then I'll check it.", correct: false })
    }

    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 400,
      messages: [
        {
          role: "user",
          content: `You are a coding tutor checking a student's answer. Be concise and specific.

Lesson: "${lessonTitle}" (concept: ${concept})

Expected solution:
\`\`\`
${solution}
\`\`\`

Student's answer:
\`\`\`
${userCode}
\`\`\`

Respond with JSON only:
{
  "correct": boolean,
  "feedback": "1-2 sentences. If wrong: point out the SPECIFIC mistake without giving the answer. If right: brief praise + what they got right.",
  "nudge": "Only if wrong: one-sentence hint that steers toward the fix without revealing it. Empty string if correct."
}`,
        },
      ],
    })

    const text = (response.content.find(b => b.type === "text") as { type: "text"; text: string } | undefined)?.text ?? ""
    const clean = text.replace(/```json\n?|\n?```/g, "").trim()

    try {
      const result = JSON.parse(clean)
      return NextResponse.json(result)
    } catch {
      return NextResponse.json({ correct: false, feedback: "Couldn't parse your code. Make sure it's valid syntax.", nudge: "" })
    }
  } catch (error) {
    console.error("[check-answer]", error)
    return NextResponse.json({ correct: false, feedback: "Check failed — try again.", nudge: "" }, { status: 500 })
  }
}
