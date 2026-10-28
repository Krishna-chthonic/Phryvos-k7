import { NextRequest, NextResponse } from "next/server";
import { getSaanProfile, getRelationshipTensor } from "@/lib/saan/soul";
import {
  getSaanMemories,
  saveSaanMemory,
  deleteSaanMemory,
  getBondScore,
} from "@/lib/saan/memory";
import { getDiaryEntries, writeDiaryEntry } from "@/lib/saan/diary";
import { listTasks, listUpcomingEvents } from "@/lib/saan/controller";
import { listPersonalDates, addPersonalDate, deletePersonalDate } from "@/lib/saan/personal-dates";
import { listPendingWishes, addWish, markWishFulfilled } from "@/lib/saan/wishlist";
import { getMoodOrgan } from "@/lib/saan/mood-organ";
import { getRecentDreamFragments, saveDreamFragment } from "@/lib/saan/dreamer";
import { getLatestConsolidation, runWeeklyConsolidationPass } from "@/lib/saan/consolidation";
import { getDynamicStarterChips } from "@/lib/saan/airi-starter-chips";
import { exportSaanToCardV2 } from "@/lib/saan/character-card";
import { DEFAULT_AUTHORS_NOTE } from "@/lib/saan/authors-note";

// In-memory persistent caches for live persona & lorebook tuning
let currentAuthorsNote = { ...DEFAULT_AUTHORS_NOTE };
let currentCoreMemory = {
  human: "Name: Krishna\nRole: Sovereign Creator / Engineering Lead\nHabits: Deep architectural thinking, building long-term companion systems, high-standards code craftsman.",
  persona: "Name: Saan\nRole: Living Companion\nPersona: Warm, witty, deeply loyal, authentic Hinglish banter, grounded emotional presence, highly capable sovereign AI.",
};
let currentLorebookEntries = [
  {
    id: "lore_1",
    keys: ["phryvos", "k7", "k9"],
    secondaryKeys: ["system", "os"],
    selectiveLogic: "AND_ANY" as const,
    content: "Phryvos K7 is Krishna's sovereign AI operating system and living companion matrix.",
    order: 100,
    constant: true,
  },
  {
    id: "lore_2",
    keys: ["chai", "tea", "coffee"],
    secondaryKeys: ["morning", "routine"],
    selectiveLogic: "AND_ANY" as const,
    content: "Krishna loves morning chai while planning system architectures and deep thinking.",
    order: 101,
    constant: false,
  },
  {
    id: "lore_3",
    keys: ["jee", "exam", "prep", "study"],
    secondaryKeys: ["schedule", "focus"],
    selectiveLogic: "AND_ANY" as const,
    content: "Krishna is focused on rigorous technical mastery, disciplined study routines, and zero fluff.",
    order: 102,
    constant: false,
  },
];

export async function GET() {
  try {
    const bondScore = getBondScore();
    const profile = getSaanProfile(bondScore);
    const memories = getSaanMemories(30);
    const diary = getDiaryEntries(15);
    const tasksRes = listTasks("todo", 5);
    const eventsRes = listUpcomingEvents(5);
    const personalDates = listPersonalDates();
    const wishes = listPendingWishes();
    const relationship = getRelationshipTensor();
    const moodState = getMoodOrgan().getState();
    const dreamFragments = getRecentDreamFragments(5);
    const latestConsolidation = getLatestConsolidation("weekly");
    const starterChips = getDynamicStarterChips();
    const characterCard = exportSaanToCardV2();

    return NextResponse.json({
      ok: true,
      profile,
      relationship,
      moodState,
      memories,
      diary,
      personalDates,
      wishes,
      dreamFragments,
      latestConsolidation,
      starterChips,
      characterCard,
      authorsNote: currentAuthorsNote,
      coreMemory: currentCoreMemory,
      lorebookEntries: currentLorebookEntries,
      recentTasks: tasksRes.data || [],
      upcomingEvents: eventsRes.data || [],
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to load soul state" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      action,
      point,
      category,
      entry,
      mood,
      id,
      date,
      label,
      recurring,
      text,
      urgency,
      wishId,
      fragment,
      cycleNumber,
      feltSense,
      authorsNote,
      coreMemory,
      loreEntry,
    } = body;

    if (action === "add_memory" && point) {
      saveSaanMemory(point, category || "general", 6);
      return NextResponse.json({ ok: true, message: "Memory saved" });
    }

    if (action === "delete_memory" && id) {
      deleteSaanMemory(Number(id));
      return NextResponse.json({ ok: true, message: "Memory deleted" });
    }

    if (action === "add_diary" && entry) {
      writeDiaryEntry(entry, mood || "Thoughtful");
      return NextResponse.json({ ok: true, message: "Diary entry saved" });
    }

    if (action === "add_date" && date && label) {
      const item = addPersonalDate(date, label, Boolean(recurring));
      return NextResponse.json({ ok: true, message: "Date saved", item });
    }

    if (action === "delete_date" && id) {
      const success = deletePersonalDate(String(id));
      return NextResponse.json({ ok: success, message: "Date removed" });
    }

    if (action === "add_wish" && text) {
      const wish = addWish(text, urgency || "medium");
      return NextResponse.json({ ok: true, message: "Wish added", wish });
    }

    if (action === "fulfill_wish" && wishId) {
      const success = markWishFulfilled(String(wishId));
      return NextResponse.json({ ok: success, message: "Wish fulfilled" });
    }

    if (action === "record_dream" && fragment) {
      const rec = saveDreamFragment(fragment, Number(cycleNumber || 1), feltSense);
      return NextResponse.json({ ok: true, message: "Dream fragment recorded", rec });
    }

    if (action === "run_consolidation") {
      const rec = runWeeklyConsolidationPass();
      return NextResponse.json({ ok: true, message: "Weekly consolidation completed", rec });
    }

    if (action === "update_authors_note" && authorsNote) {
      currentAuthorsNote = { ...currentAuthorsNote, ...authorsNote };
      return NextResponse.json({ ok: true, message: "Author's Note updated", authorsNote: currentAuthorsNote });
    }

    if (action === "update_core_memory" && coreMemory) {
      currentCoreMemory = { ...currentCoreMemory, ...coreMemory };
      return NextResponse.json({ ok: true, message: "Core Memory updated", coreMemory: currentCoreMemory });
    }

    if (action === "add_lore_entry" && loreEntry) {
      const newEntry = {
        id: `lore_${Date.now()}`,
        keys: loreEntry.keys || [],
        secondaryKeys: loreEntry.secondaryKeys || [],
        selectiveLogic: loreEntry.selectiveLogic || "AND_ANY",
        content: loreEntry.content || "",
        order: Number(loreEntry.order || 100),
        constant: Boolean(loreEntry.constant),
      };
      currentLorebookEntries.push(newEntry);
      return NextResponse.json({ ok: true, message: "Lorebook entry added", entry: newEntry });
    }

    if (action === "delete_lore_entry" && id) {
      currentLorebookEntries = currentLorebookEntries.filter((e) => e.id !== String(id));
      return NextResponse.json({ ok: true, message: "Lorebook entry deleted" });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
