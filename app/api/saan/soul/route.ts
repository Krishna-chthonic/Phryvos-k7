import { NextRequest, NextResponse } from "next/server";
import { getSaanProfile } from "@/lib/saan/soul";
import {
  getSaanMemories,
  saveSaanMemory,
  deleteSaanMemory,
  getBondScore,
} from "@/lib/saan/memory";
import { getDiaryEntries, writeDiaryEntry } from "@/lib/saan/diary";
import { listTasks, listUpcomingEvents } from "@/lib/saan/controller";

export async function GET() {
  try {
    const bondScore = getBondScore();
    const profile = getSaanProfile(bondScore);
    const memories = getSaanMemories(30);
    const diary = getDiaryEntries(15);
    const tasksRes = listTasks("todo", 5);
    const eventsRes = listUpcomingEvents(5);

    return NextResponse.json({
      ok: true,
      profile,
      memories,
      diary,
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
    const { action, point, category, entry, mood, id } = body;

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

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
