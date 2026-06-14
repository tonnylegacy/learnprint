import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatXp(xp: number): string {
  if (xp >= 1000) return `${(xp / 1000).toFixed(1)}k`
  return xp.toString()
}

export function getLevelFromXp(xp: number): { level: number; title: string; nextLevelXp: number } {
  const thresholds = [
    { xp: 0, title: "Curious Builder" },
    { xp: 300, title: "Code Explorer" },
    { xp: 700, title: "Stack Learner" },
    { xp: 1200, title: "Pattern Spotter" },
    { xp: 2000, title: "Architecture Thinker" },
    { xp: 3500, title: "Full Stack Craftsman" },
    { xp: 5000, title: "Code Architect" },
  ]

  let level = 1
  let nextLevelXp = thresholds[1].xp

  for (let i = thresholds.length - 1; i >= 0; i--) {
    if (xp >= thresholds[i].xp) {
      level = i + 1
      nextLevelXp = thresholds[i + 1]?.xp ?? thresholds[i].xp
      break
    }
  }

  return { level, title: thresholds[level - 1].title, nextLevelXp }
}

export function getDifficultyColor(difficulty: string): string {
  switch (difficulty) {
    case "beginner": return "text-emerald-400 bg-emerald-400/10"
    case "intermediate": return "text-amber-400 bg-amber-400/10"
    case "advanced": return "text-rose-400 bg-rose-400/10"
    default: return "text-slate-400 bg-slate-400/10"
  }
}
