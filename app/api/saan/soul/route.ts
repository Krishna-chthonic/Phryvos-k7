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

    return NextResponse.json({
      ok: true,
      profile,
      relationship,
      memories,
      diary,
      personalDates,
      wishes,
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
    const { action, point, category, entry, mood, id, date, label, recurring, text, urgency, wishId } = body;

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

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
