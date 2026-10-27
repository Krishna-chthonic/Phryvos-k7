/**
 * Dynamic Context-Aware Starter Chips (from moeru-ai/airi stage-ui)
 *
 * Implements:
 * Real-time synthesis of circadian state, due tasks, open deeds, and personal dates
 * into intelligent, conversational starter prompts for the companion interface.
 */

import { getDb } from "@/lib/db/client";
import { getCircadianState } from "@/lib/saan/soul";
import { loadLedgerFromDb, openDeeds } from "@/lib/saan/ledger";
import { getUpcomingDates, getUpcomingPersonalDates } from "@/lib/saan/personal-dates";

export interface StarterChip {
  id: string;
  label: string;
  prompt: string;
  icon?: "sun" | "coffee" | "briefcase" | "moon" | "check-circle" | "calendar" | "heart";
  category: "circadian" | "task" | "deed" | "personal_date" | "casual";
}

/**
 * Returns dynamic, context-aware starter chips for the current moment.
 */
export function getDynamicStarterChips(): StarterChip[] {
  const chips: StarterChip[] = [];
  const now = new Date();
  const currentHour = now.getHours();
  const circadian = getCircadianState(currentHour);

  // 1. Circadian-Aware Primary Chip
  switch (circadian) {
    case "morning_chai":
      chips.push({
        id: "chip_morning",
        label: "Morning Chai & Agenda",
        prompt: "Good morning Saan! Aaj ka main focus aur priorities kya hain?",
        icon: "coffee",
        category: "circadian",
      });
      break;
    case "work_focus":
      chips.push({
        id: "chip_work",
        label: "Work Mode & Tasks",
        prompt: "Check karo mere kitne tasks pending hain aur next kya karna hai.",
        icon: "briefcase",
        category: "circadian",
      });
      break;
    case "evening_unwind":
      chips.push({
        id: "chip_evening",
        label: "Day Recap & Unwind",
        prompt: "Aaj ka din kaisa raha? Thoda chill baat karte hain.",
        icon: "heart",
        category: "circadian",
      });
      break;
    case "sleep":
    default:
      chips.push({
        id: "chip_sleep",
        label: "Late Night Check-in",
        prompt: "Late night coding session chal raha hai... sab theek hai na?",
        icon: "moon",
        category: "circadian",
      });
      break;
  }

  // 2. Due Tasks Contextual Chip
  try {
    const db = getDb();
    const todayStr = now.toISOString().split("T")[0];
    const dueTasks = db.prepare(`
      SELECT count(*) as count 
      FROM tasks 
      WHERE status != 'done' AND due_date <= ?
    `).get(todayStr) as { count: number };

    if (dueTasks && dueTasks.count > 0) {
      chips.push({
        id: "chip_due_tasks",
        label: `${dueTasks.count} Due Tasks`,
        prompt: `Aaj ${dueTasks.count} tasks due hain, unhe review karke complete karwao.`,
        icon: "check-circle",
        category: "task",
      });
    }
  } catch {}

  // 3. Open Consequence Deed Contextual Chip
  try {
    const ledger = loadLedgerFromDb();
    const activeDeeds = openDeeds(ledger);
    if (activeDeeds.length > 0) {
      const topDeed = activeDeeds[0];
      const preview = topDeed.text.length > 30 ? topDeed.text.slice(0, 27) + "..." : topDeed.text;
      chips.push({
        id: `chip_deed_${topDeed.id}`,
        label: `Follow-up: ${preview}`,
        prompt: `Update on deed: "${topDeed.text}" — kya status hai?`,
        icon: "check-circle",
        category: "deed",
      });
    }
  } catch {}

  // 4. Upcoming Personal Date Contextual Chip
  try {
    const upcoming = getUpcomingPersonalDates(7);
    if (upcoming.length > 0) {
      const topDate = upcoming[0];
      chips.push({
        id: `chip_date_${topDate.id}`,
        label: `Upcoming: ${topDate.label}`,
        prompt: `Remember: ${topDate.label} is coming up soon on ${topDate.date}. Kuch special plan hai?`,
        icon: "calendar",
        category: "personal_date",
      });
    }
  } catch {}

  // 5. Fallback Casual Companion Chips if < 4
  const casualDefaults: StarterChip[] = [
    {
      id: "chip_casual_1",
      label: "Kaisa chal raha hai?",
      prompt: "Kaisa chal raha hai sab kuch? Kuch interesting share karo.",
      icon: "coffee",
      category: "casual",
    },
    {
      id: "chip_casual_2",
      label: "Schedule Review",
      prompt: "Kal aur parso ka calendar schedule review kar do.",
      icon: "calendar",
      category: "casual",
    },
    {
      id: "chip_casual_3",
      label: "Mindfulness Check",
      prompt: "Saan, tum abhi kaisa feel kar rahi ho? Emotional state batao.",
      icon: "heart",
      category: "casual",
    },
  ];

  for (const c of casualDefaults) {
    if (chips.length >= 4) break;
    if (!chips.some((existing) => existing.id === c.id)) {
      chips.push(c);
    }
  }

  return chips.slice(0, 4);
}
