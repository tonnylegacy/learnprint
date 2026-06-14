export type Difficulty = "beginner" | "intermediate" | "advanced"

export interface Challenge {
  question: string
  instructions: string
  starterCode: string
  solution: string
  hint: string
  xp: number
}

export interface Lesson {
  id: string
  title: string
  type: "explanation" | "challenge" | "quiz"
  content: string           // markdown explanation
  codeReference?: string    // file path in the user's project
  codeSnippet?: string      // actual code from their project
  challenge?: Challenge
  xp: number
}

export interface Module {
  id: string
  title: string
  description: string
  icon: string              // emoji
  difficulty: Difficulty
  concepts: string[]        // e.g. ["supabase-auth", "rls", "sessions"]
  lessons: Lesson[]
  totalXp: number
}

export interface TechStack {
  framework: string         // Next.js, React, Vue, etc.
  language: string          // TypeScript, JavaScript, Python
  database?: string         // Supabase, PostgreSQL, MongoDB
  auth?: string             // Supabase Auth, NextAuth, Clerk
  styling?: string          // Tailwind, CSS Modules, Styled Components
  deployment?: string       // Vercel, Netlify, Railway
  other: string[]           // additional detected tools
}

export interface Curriculum {
  id: string
  projectName: string
  projectUrl: string
  techStack: TechStack
  difficulty: Difficulty
  summary: string           // 2-sentence project overview
  totalXp: number
  estimatedHours: number
  modules: Module[]
  generatedAt: string
}

export interface UserProgress {
  curriculumId: string
  completedLessons: string[]   // lesson IDs
  totalXpEarned: number
  currentStreak: number
  lastActivityAt: string
}

export interface AnalyzeRequest {
  githubUrl: string
  userId?: string
}

export interface AnalyzeResponse {
  curriculum: Curriculum
  curriculumId: string
}

export interface RepoFile {
  path: string
  content: string
  size: number
}

export interface ParsedRepo {
  owner: string
  repo: string
  defaultBranch: string
  files: RepoFile[]
  packageJson?: Record<string, unknown>
  fileTree: string[]
}
