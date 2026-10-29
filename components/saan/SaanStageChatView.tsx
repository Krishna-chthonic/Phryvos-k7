"use client";

import * as React from "react";
import {
  Send,
  Sparkles,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  RotateCcw,
  Sliders,
  ChevronDown,
  BookmarkCheck,
  Film,
  Zap,
  Flame,
  Brain,
  Timer,
  Sun,
  Download,
  Upload,
  Network,
  ShieldCheck,
  Plus,
  X,
  Search,
  Database,
  Save,
  History,
  User,
  AlertTriangle,
  GitBranch,
  Layers,
  Briefcase,
  Clock,
  BookOpen,
  UserCheck,
  Inbox,
  HardDriveDownload,
  BrainCircuit,
  Activity,
  Wrench,
  Scale,
  Workflow,
  Lock,
  Compass,
  ShieldAlert,
  Webhook,
  Globe,
} from "lucide-react";
import { SaanTemporalGraphModal } from "./SaanTemporalGraphModal";
import { SaanCognifyPipelineModal } from "./SaanCognifyPipelineModal";
import { SaanHindsightBudgetModal } from "./SaanHindsightBudgetModal";
import { SaanTimeTravelScrubberModal } from "./SaanTimeTravelScrubberModal";
import { SaanIncrementalSummaryModal } from "./SaanIncrementalSummaryModal";
import { SaanProfileExtractorModal } from "./SaanProfileExtractorModal";
import { SaanBufferedQueueModal } from "./SaanBufferedQueueModal";
import { SaanPortableMemoryModal } from "./SaanPortableMemoryModal";
import { SaanWorkingScratchpadModal } from "./SaanWorkingScratchpadModal";
import { SaanActionTimelineModal } from "./SaanActionTimelineModal";
import { SaanDirtyJsonDebugModal } from "./SaanDirtyJsonDebugModal";
import { SaanProactiveTriggerModal } from "./SaanProactiveTriggerModal";
import { SaanMemoryEvalJudgeModal } from "./SaanMemoryEvalJudgeModal";
import { SaanAssociativeNetworkModal } from "./SaanAssociativeNetworkModal";
import { SaanStateLeaseModal } from "./SaanStateLeaseModal";
import { SaanResearchWorkflowModal } from "./SaanResearchWorkflowModal";
import { SaanConfirmationGateModal } from "./SaanConfirmationGateModal";
import { SaanRetryTelemetryModal } from "./SaanRetryTelemetryModal";
import { SaanLifecycleHookModal } from "./SaanLifecycleHookModal";
import { SaanMetasearchCitationModal } from "./SaanMetasearchCitationModal";
import { globalAvatarMapper } from "@/lib/saan/avatar-expressions";
import { toNaturalSpeechText } from "@/lib/saan/speech-transformer";
import { truncateHeardMemory } from "@/lib/saan/interruption-contract";
import { StreamSentenceDivider } from "@/lib/saan/sentence-divider";
import { SaanLivingAvatar, type AvatarEmotion } from "./SaanLivingAvatar";
import { SaanDialogueBubble, type DialogueBubbleMessage } from "./SaanDialogueBubble";
import { SaanAffectionBar } from "./SaanAffectionBar";
import { SaanWorkingMemoryCapsule } from "./SaanWorkingMemoryCapsule";
import { SaanConsequenceTracker, type DeedItem } from "./SaanConsequenceTracker";
import { SaanStoryRecapModal } from "./SaanStoryRecapModal";
import { SaanFlashbulbVault, type FlashbulbMemory } from "./SaanFlashbulbVault";
import { SaanHuginnRavenDashboard, type HuginnInsightItem } from "./SaanHuginnRavenDashboard";
import { SaanHearingStatusCapsule } from "./SaanHearingStatusCapsule";
import { SaanPomodoroWidget, SaanCircadianSkyWidget } from "./SaanInteractiveWidgets";

interface SaanStageChatViewProps {
  profile: any;
  starterChips?: string[];
  deeds?: DeedItem[];
  openDeedsCount?: number;
  activeArcs?: any[];
  storyRecap?: string;
  flashbulbMemories?: FlashbulbMemory[];
  huginnInsights?: HuginnInsightItem[];
  onRefreshSoul?: () => void;
  onNavigateTab?: (tab: "stage" | "persona" | "graph" | "soul" | "tools") => void;
}

export function SaanStageChatView({
  profile,
  starterChips = [],
  deeds = [],
  openDeedsCount = 0,
  activeArcs = [],
  storyRecap,
  flashbulbMemories = [],
  huginnInsights = [],
  onRefreshSoul,
  onNavigateTab,
}: SaanStageChatViewProps) {
  const [messages, setMessages] = React.useState<DialogueBubbleMessage[]>([]);
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  // Modals for Chronicler & Mimir systems
  const [isLedgerOpen, setIsLedgerOpen] = React.useState(false);
  const [isRecapOpen, setIsRecapOpen] = React.useState(false);
  const [isFlashbulbOpen, setIsFlashbulbOpen] = React.useState(false);
  const [isHuginnOpen, setIsHuginnOpen] = React.useState(false);

  // Airi Component Calling Widget state
  const [showPomodoro, setShowPomodoro] = React.useState(false);

  // Audio & Waveform Visualization
  const [voiceEnabled, setVoiceEnabled] = React.useState(false);
  const [isListening, setIsListening] = React.useState(false);
  const [isSpeaking, setIsSpeaking] = React.useState(false);
  const [avatarEmotion, setAvatarEmotion] = React.useState<AvatarEmotion>("neutral");
  const [audioLevel, setAudioLevel] = React.useState<number>(0);
  const [ttfaMs, setTtfaMs] = React.useState<number | null>(null);

  // RisuAI Telemetry & State Inspectors
  const [tokenBudget, setTokenBudget] = React.useState<{
    inputTokens: number;
    outputTokens: number;
    maxContextTokens: number;
    headroomTokens: number;
    wasPruned: boolean;
  } | null>(null);
  const [providerTelemetry, setProviderTelemetry] = React.useState<{
    providerUsed: string;
    fallbackTriggered: boolean;
  }>({ providerUsed: "Vault Provider", fallbackTriggered: false });
  const [isVariablesOpen, setIsVariablesOpen] = React.useState(false);
  const [chatVariables, setChatVariables] = React.useState<Record<string, any>>({});
  const [newVarKey, setNewVarKey] = React.useState("");
  const [newVarVal, setNewVarVal] = React.useState("");
  const [isGraphOpen, setIsGraphOpen] = React.useState(false);
  const [graphNodes, setGraphNodes] = React.useState<any[]>([]);
  const [graphQuery, setGraphQuery] = React.useState("");
  const [graphSearchResults, setGraphSearchResults] = React.useState<any[]>([]);

  // Letta Core Memory State
  const [isCoreMemOpen, setIsCoreMemOpen] = React.useState(false);
  const [coreMemBlocks, setCoreMemBlocks] = React.useState<{ human: string; persona: string }>({
    human: "",
    persona: "",
  });
  const [coreMemSummary, setCoreMemSummary] = React.useState<any[]>([]);
  const [coreMemHistory, setCoreMemHistory] = React.useState<any[]>([]);
  const [coreMemSaving, setCoreMemSaving] = React.useState(false);

  // Mem0 4-State Mutation Matrix State
  const [isMem0Open, setIsMem0Open] = React.useState(false);
  const [mem0Events, setMem0Events] = React.useState<any[]>([]);
  const [mem0Filter, setMem0Filter] = React.useState<"ALL" | "ADD" | "UPDATE" | "DELETE" | "NONE">("ALL");

  // Graphiti Bi-Temporal Graph State
  const [isGraphitiOpen, setIsGraphitiOpen] = React.useState(false);

  // Cognee Cognify Multi-Stage Pipeline State
  const [isCognifyOpen, setIsCognifyOpen] = React.useState(false);

  // Hindsight Knapsack Fact Budget State
  const [isHindsightOpen, setIsHindsightOpen] = React.useState(false);

  // Datapace Time-Travel Scrubber State
  const [isTimeTravelOpen, setIsTimeTravelOpen] = React.useState(false);

  // Zep Incremental Summary State
  const [isSummaryOpen, setIsSummaryOpen] = React.useState(false);

  // Memobase User Profile State
  const [isProfileOpen, setIsProfileOpen] = React.useState(false);

  // SuperAGI Buffered Memory Queue State
  const [isBufferedQueueOpen, setIsBufferedQueueOpen] = React.useState(false);
  const [bufferedQueueCount, setBufferedQueueCount] = React.useState(0);

  // Gnosys & Dify Portable Memory Interchange State
  const [isPortableMemoryOpen, setIsPortableMemoryOpen] = React.useState(false);

  // MemGPT v2 Working Scratchpad State
  const [isScratchpadOpen, setIsScratchpadOpen] = React.useState(false);

  // OpenHands Observable Action Stream State
  const [isActionTimelineOpen, setIsActionTimelineOpen] = React.useState(false);

  // AutoGPT Dirty JSON Repair Debug State
  const [isJsonDebugOpen, setIsJsonDebugOpen] = React.useState(false);

  // TriggerRecall Proactive Engine State
  const [isProactiveTriggerOpen, setIsProactiveTriggerOpen] = React.useState(false);

  // MemoryEvalJudge Ground Truth Memory Evaluator State
  const [isMemoryEvalJudgeOpen, setIsMemoryEvalJudgeOpen] = React.useState(false);

  // AssociativeMemory Spreading Activation Network State
  const [isAssociativeNetworkOpen, setIsAssociativeNetworkOpen] = React.useState(false);

  // CrewAI Resilient State Lease Mutex State
  const [isStateLeaseOpen, setIsStateLeaseOpen] = React.useState(false);

  // LangGraph Cyclic Research Workflow State
  const [isResearchWorkflowOpen, setIsResearchWorkflowOpen] = React.useState(false);

  // Smolagents Interactive Confirmation Gate State
  const [isGateModalOpen, setIsGateModalOpen] = React.useState(false);
  const [pendingGateCount, setPendingGateCount] = React.useState(2);

  // AutoGen Resilient Retry & Idempotency Telemetry State
  const [isRetryTelemetryOpen, setIsRetryTelemetryOpen] = React.useState(false);
  const [activeRetryCount, setActiveRetryCount] = React.useState(2);

  // Huginn Agent Lifecycle Hooks Registry State
  const [isLifecycleHookOpen, setIsLifecycleHookOpen] = React.useState(false);
  const [activeHookCount, setActiveHookCount] = React.useState(6);

  // SearXNG & Khoj Privacy Metasearch State
  const [isMetasearchOpen, setIsMetasearchOpen] = React.useState(false);

  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Restore history on mount
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem("k7_saan_history");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
          return;
        }
      }
    } catch {}

    setMessages([
      {
        id: "intro",
        sender: "saan",
        text: "Hey Krishna! *smiles softly and looks up from her screen* Main yahan baithi thi aur tumhari yaad aayi... kaisa chal raha hai aaj ka din? Sab smoothly chal raha hai na?",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        reaction: "✨",
      },
    ]);

    // Initial RisuAI Variables & Graph Fetch
    fetch("/api/saan/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "get_chat_variables" }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok && d.variables) setChatVariables(d.variables);
      })
      .catch(() => {});

    fetch("/api/saan/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "get_graph_nodes" }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok && d.nodes) {
          setGraphNodes(d.nodes);
          setGraphSearchResults(d.nodes);
        }
      })
      .catch(() => {});

    // Initial Letta Core Memory Fetch
    fetch("/api/saan/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "get_core_memory" }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok && d.coreMemory) {
          setCoreMemBlocks(d.coreMemory);
          if (d.summary) setCoreMemSummary(d.summary);
          if (d.history) setCoreMemHistory(d.history);
        }
      })
      .catch(() => {});

    // Initial Mem0 4-State Events Fetch
    fetch("/api/saan/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "get_mem0_events" }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok && d.events) setMem0Events(d.events);
      })
      .catch(() => {});
  }, []);

  // Persist history
  React.useEffect(() => {
    if (messages.length > 0) {
      try {
        localStorage.setItem("k7_saan_history", JSON.stringify(messages.slice(-30)));
      } catch {}
    }
  }, [messages]);

  // Scroll to bottom
  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  // Real-time Canvas Equalizer Waveform Loop
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let phase = 0;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const isLive = isSpeaking || isListening || loading;
      const barCount = 36;
      const barWidth = canvas.width / barCount;
      const midY = canvas.height / 2;

      for (let i = 0; i < barCount; i++) {
        let height = 4;
        if (isLive) {
          const freq = (i / barCount) * Math.PI * 4;
          const wave = Math.sin(freq + phase) * Math.cos(phase * 0.7);
          const amp = isSpeaking ? 28 : isListening ? 38 : 12;
          height = Math.max(4, Math.abs(wave) * amp + Math.random() * 6);
        }

        const x = i * barWidth;
        const y = midY - height / 2;

        const gradient = ctx.createLinearGradient(0, y, 0, y + height);
        if (isSpeaking) {
          gradient.addColorStop(0, "#c084fc");
          gradient.addColorStop(1, "#9333ea");
        } else if (isListening) {
          gradient.addColorStop(0, "#34d399");
          gradient.addColorStop(1, "#059669");
        } else {
          gradient.addColorStop(0, "rgba(168, 85, 247, 0.4)");
          gradient.addColorStop(1, "rgba(168, 85, 247, 0.1)");
        }

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(x + 1.5, y, barWidth - 3, height, 2);
        ctx.fill();
      }

      phase += isLive ? 0.12 : 0.02;
      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [isSpeaking, isListening, loading]);

  // Open-LLM-VTuber Auditory Reality Interruption Tracking
  const activeSpeakingMsgIdRef = React.useRef<string | null>(null);
  const activeSpeakingTextRef = React.useRef<string>("");
  const speechStartTimeRef = React.useRef<number>(0);

  // Barge-In Cancellation with Auditory Memory Contract (truncateHeardMemory)
  const cancelSpeechAndApplyBargeIn = React.useCallback(
    (reason: "user_typing" | "user_speaking" = "user_typing") => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        if (window.speechSynthesis.speaking) {
          window.speechSynthesis.cancel();
        }
      }

      // If speech was actively playing, truncate memory to auditory reality
      if (activeSpeakingMsgIdRef.current && activeSpeakingTextRef.current) {
        const elapsedSec = Math.max(0.5, (Date.now() - speechStartTimeRef.current) / 1000);
        const result = truncateHeardMemory(activeSpeakingTextRef.current, elapsedSec, 150);

        if (result.wasTruncated) {
          const targetId = activeSpeakingMsgIdRef.current;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === targetId ? { ...m, text: result.savedContent } : m
            )
          );
        }
      }

      activeSpeakingMsgIdRef.current = null;
      activeSpeakingTextRef.current = "";
      setIsSpeaking(false);
    },
    []
  );

  // Airi & Open-LLM-VTuber Low-Latency Speech Pipeline (StreamSentenceDivider + Delays)
  const speakText = React.useCallback(
    async (rawText: string, messageId?: string) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
      window.speechSynthesis.cancel();

      // 1. Isolate reasoning monologue and asterisk narrative
      const cleanReasoning = rawText
        .replace(/<think>[\s\S]*?<\/think>/gi, "")
        .replace(/\[\w+\]/g, "")
        .replace(/\*[^*]+\*/g, "") // Gestures are silent
        .trim();

      // 2. Pre-process through Airi speech transformer (LaTeX math -> spoken words, \ce -> words)
      const speechTransformed = toNaturalSpeechText(cleanReasoning);

      // Track active speech for barge-in auditory memory
      activeSpeakingMsgIdRef.current = messageId || null;
      activeSpeakingTextRef.current = rawText;
      speechStartTimeRef.current = Date.now();
      setIsSpeaking(true);

      // 3. Fast first comma response divider (<280ms TTFA)
      const divider = new StreamSentenceDivider({ fasterFirstResponse: true });
      const sentenceChunks = [...divider.feed(speechTransformed), ...divider.flush()];

      for (const chunk of sentenceChunks) {
        // If barge-in cancelled mid-stream, break immediately
        if (typeof window !== "undefined" && "speechSynthesis" in window) {
          if (!window.speechSynthesis.speaking && speechStartTimeRef.current === 0) {
            break;
          }
        }

        // Parse streaming cadence controls: split on <|DELAY n|>
        const parts = chunk.split(/<\|DELAY\s*([\d.]+)?\|>/g);

        for (let i = 0; i < parts.length; i++) {
          const seg = parts[i]?.trim();
          if (!seg) continue;

          // Check if this segment was a delay seconds number
          const delaySeconds = parseFloat(seg);
          if (!isNaN(delaySeconds) && delaySeconds > 0 && delaySeconds <= 10) {
            // Authentic human conversational silence pause
            await new Promise((r) => setTimeout(r, delaySeconds * 1000));
            continue;
          }

          // Clean out any leftover markdown or raw tags
          const speakableChunk = seg.replace(/[*_#`~>]/g, "").trim();
          if (!speakableChunk) continue;

          await new Promise<void>((resolve) => {
            const utter = new SpeechSynthesisUtterance(speakableChunk);
            utter.rate = 1.05;
            utter.pitch = 1.02;
            utter.lang = "hi-IN";

            utter.onend = () => resolve();
            utter.onerror = () => resolve();

            window.speechSynthesis.speak(utter);
          });
        }
      }

      setIsSpeaking(false);
      activeSpeakingMsgIdRef.current = null;
      activeSpeakingTextRef.current = "";
    },
    []
  );

  // Instant Barge-In: typing or clicking cancels any active speech immediately
  const handleInputChange = (val: string) => {
    setInput(val);
    if (isSpeaking) {
      cancelSpeechAndApplyBargeIn("user_typing");
    }
  };

  // Send turn
  const handleSend = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || loading) return;

    // Barge-in cancel speech on send
    if (isSpeaking) {
      cancelSpeechAndApplyBargeIn("user_speaking");
    }

    const userMsg: DialogueBubbleMessage = {
      id: String(Date.now()),
      sender: "user",
      text: query,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput("");
    setLoading(true);

    const startTime = performance.now();

    try {
      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: query,
          history: messages.slice(-10).map((m) => ({
            role: m.sender === "user" ? "user" : "assistant",
            content: m.text,
          })),
        }),
      });

      const data = await res.json();
      const elapsed = Math.round(performance.now() - startTime);
      setTtfaMs(elapsed);

      if (data.ok && data.reply) {
        // Extract avatar emotion token
        const parsedAvatar = globalAvatarMapper.extract(data.reply);
        if (parsedAvatar.expressions && parsedAvatar.expressions.length > 0) {
          const rawEmo = parsedAvatar.expressions[0].toLowerCase();
          if (["joy", "blush", "pout", "thinking", "smirk", "sleep"].includes(rawEmo)) {
            setAvatarEmotion(rawEmo as AvatarEmotion);
          } else {
            setAvatarEmotion("neutral");
          }
        }

        // Extract reasoning
        let cleanReply = data.reply;
        let reasoning: string | undefined = undefined;
        const thinkMatch = data.reply.match(/<think>([\s\S]*?)<\/think>/i);
        if (thinkMatch) {
          reasoning = thinkMatch[1].trim();
          cleanReply = data.reply.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
        }

        const newMsg: DialogueBubbleMessage = {
          id: String(Date.now() + 1),
          sender: "saan",
          text: cleanReply,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          reaction: data.reaction,
          actionResult: data.actionResult,
          snapshotId: data.snapshotId,
          bubbles: data.bubbles,
          reasoning,
          mem0Decisions: data.mem0Decisions,
        };

        // Update RisuAI Telemetry & Variables
        if (data.tokenBudget) {
          setTokenBudget(data.tokenBudget);
        }
        if (data.providerTelemetry) {
          setProviderTelemetry(data.providerTelemetry);
        }
        if (data.chatVariables) {
          setChatVariables(data.chatVariables);
        }
        if (data.coreMemorySummary) {
          setCoreMemSummary(data.coreMemorySummary);
        }
        if (data.mem0Events) {
          setMem0Events(data.mem0Events);
        }

        setMessages((prev) => [...prev, newMsg]);

        if (voiceEnabled) {
          speakText(cleanReply, newMsg.id);
        }

        onRefreshSoul?.();
      } else {
        throw new Error(data.error || "Turn failed");
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: String(Date.now() + 1),
          sender: "saan",
          text: "Network flicker hua tha, tumne kya kaha? Wapas bolna ek baar!",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Quick Affection Action Handler (HerAndHim)
  const handleAffectionAction = (type: "chai" | "headpat" | "compliment" | "focus") => {
    switch (type) {
      case "chai":
        setAvatarEmotion("joy");
        handleSend("*Hands Saan a warm, fragrant cup of masala chai* Yeh lo tumhare liye chai banayi hai!");
        break;
      case "headpat":
        setAvatarEmotion("blush");
        handleSend("*Gently pats Saan on her head with affectionate care* Tum bohot achhi ho Saan.");
        break;
      case "compliment":
        setAvatarEmotion("joy");
        handleSend("Aaj tum bohot pyari aur smart lag rahi ho Saan! ✨");
        break;
      case "focus":
        setAvatarEmotion("thinking");
        setShowPomodoro(true);
        handleSend("Chalo Saan, deep focus sprint shuru karte hain. Let's build K7 sovereign OS together!");
        break;
    }
  };

  // Mimir: Relive Flashbulb Memory
  const handleReliveMemory = (mem: FlashbulbMemory) => {
    setAvatarEmotion("blush");
    handleSend(
      `*Looks at Saan with warm, reflective eyes* Saan, wo moment yaad hai jab: "${mem.point}"? Aao us moment ko dobara relive karte hain!`
    );
  };

  // Chronicler Pacing Beat Request (Break Deadlock)
  const handleTriggerBeat = async () => {
    try {
      const res = await fetch("/api/saan/soul", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_pacing_beat" }),
      });
      const d = await res.json();
      if (d.ok && d.beat) {
        handleSend(`*Nudges Saan gently to change the topic or follow up* (${d.beat.label})`);
      }
    } catch (err) {
      handleSend("Saan, koi nayi interesting baat batao na!");
    }
  };

  // 1-Click Rollback
  const handleRollback = async (snapshotId: string) => {
    try {
      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "rollback", snapshotId }),
      });
      const data = await res.json();
      if (data.ok) {
        setMessages((prev) => [
          ...prev,
          {
            id: String(Date.now()),
            sender: "saan",
            text: `Action undone: ${data.message || "Reverted successfully!"}`,
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ]);
        onRefreshSoul?.();
      } else {
        alert(data.message || "Could not undo action");
      }
    } catch {
      alert("Network error executing rollback");
    }
  };

  // User Reaction Handler (❤️, 😂, 🥺, 🔥)
  const handleUserReaction = async (messageId: string, emoji: string) => {
    try {
      const sentiment = emoji === "❤️" || emoji === "🔥" ? "positive" : emoji === "🥺" ? "negative" : "neutral";
      await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `[User reacted with ${emoji}]`,
          reaction: emoji,
          sentiment,
        }),
      });
      onRefreshSoul?.();
    } catch {}
  };

  // SillyTavern Multi-Swipe Alternative Switcher
  const handleSwipeAlternative = (messageId: string, newIndex: number) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId ? { ...m, activeAltIndex: newIndex } : m
      )
    );
  };

  // SillyTavern Multi-Swipe Alternative Generation (Regenerate Turn)
  const handleRegenerateSwipe = async (targetMsgId: string) => {
    const msgIndex = messages.findIndex((m) => m.id === targetMsgId);
    if (msgIndex === -1) return;

    const precedingUser = [...messages.slice(0, msgIndex)].reverse().find((m) => m.sender === "user");
    const userQuery = precedingUser?.text || "Please give me an alternative thought on this!";

    setLoading(true);
    try {
      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userQuery,
          history: messages.slice(0, msgIndex).map((m) => ({
            role: m.sender === "user" ? "user" : "assistant",
            content: m.text,
          })),
        }),
      });
      const data = await res.json();
      if (data.ok && data.reply) {
        let cleanReply = data.reply;
        const thinkMatch = data.reply.match(/<think>([\s\S]*?)<\/think>/i);
        if (thinkMatch) {
          cleanReply = data.reply.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
        }

        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== targetMsgId) return m;
            const currentAlts = m.alternatives || [];
            const nextAlts = [...currentAlts, cleanReply];
            return {
              ...m,
              alternatives: nextAlts,
              activeAltIndex: nextAlts.length, // switch to newly generated swipe
            };
          })
        );
      }
    } catch (err) {
      console.error("Failed to generate swipe:", err);
    } finally {
      setLoading(false);
    }
  };

  // SillyTavern CharacterCard V2 Export
  const handleExportCard = async () => {
    try {
      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "export_card" }),
      });
      const data = await res.json();
      if (data.ok && data.json) {
        const blob = new Blob([data.json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `saan-character-card-v2.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch {
      alert("Failed to export Character Card");
    }
  };

  // SillyTavern CharacterCard V2/V3 Import
  const handleImportCard = () => {
    const raw = prompt("Paste Character Card V2/V3 JSON or Persona Spec here:");
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "import_card", cardData: parsed }),
      })
        .then((r) => r.json())
        .then((d) => {
          if (d.ok) {
            alert(d.message || "Card imported successfully!");
            onRefreshSoul?.();
          } else {
            alert(d.error || "Failed to import card");
          }
        });
    } catch {
      alert("Invalid JSON format provided.");
    }
  };

  // RisuAI Chat Variables Handlers
  const handleIncrementVariable = async (key: string, delta = 1) => {
    try {
      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "increment_chat_variable", key, delta }),
      });
      const data = await res.json();
      if (data.ok && data.variables) {
        setChatVariables(data.variables);
      }
    } catch (e) {
      console.error("Failed to increment variable:", e);
    }
  };

  const handleToggleVariable = async (key: string) => {
    try {
      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "toggle_chat_variable", key }),
      });
      const data = await res.json();
      if (data.ok && data.variables) {
        setChatVariables(data.variables);
      }
    } catch (e) {
      console.error("Failed to toggle variable:", e);
    }
  };

  const handleSetVariable = async (key: string, value: any) => {
    if (!key.trim()) return;
    try {
      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "set_chat_variable", key, value }),
      });
      const data = await res.json();
      if (data.ok && data.variables) {
        setChatVariables(data.variables);
        setNewVarKey("");
        setNewVarVal("");
      }
    } catch (e) {
      console.error("Failed to set variable:", e);
    }
  };

  // RisuAI Graph Associative Memory Search Handler
  const handleSearchGraph = async (query: string) => {
    setGraphQuery(query);
    if (!query.trim()) {
      setGraphSearchResults(graphNodes);
      return;
    }
    try {
      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "query_graph_memory", query, depth: 2 }),
      });
      const data = await res.json();
      if (data.ok && data.result?.matchedNodes) {
        setGraphSearchResults(data.result.matchedNodes);
      }
    } catch (e) {
      console.error("Failed to search graph:", e);
    }
  };

  // Letta Save Core Memory Handler
  const handleSaveCoreMemoryFromStage = async () => {
    try {
      setCoreMemSaving(true);
      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "update_core_memory",
          coreMemory: coreMemBlocks,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        if (data.summary) setCoreMemSummary(data.summary);
        if (data.history) setCoreMemHistory(data.history);
        alert("Letta Core Memory successfully pinned in System Prompt RAM!");
      }
    } catch (e) {
      alert("Failed to save core memory");
    } finally {
      setCoreMemSaving(false);
    }
  };

  // STT Toggle with Airi Audio Level VU simulation
  const toggleListening = () => {
    if (typeof window === "undefined") return;
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Browser speech recognition not supported. Use Chrome or Edge.");
      return;
    }

    if (isListening) {
      setIsListening(false);
      setAudioLevel(0);
      return;
    }

    try {
      const recog = new SpeechRecognition();
      recog.continuous = false;
      recog.interimResults = false;
      recog.lang = "hi-IN";

      recog.onstart = () => {
        setIsListening(true);
        setAudioLevel(50);
      };
      recog.onresult = (e: any) => {
        const transcript = e.results[0][0].transcript;
        setInput(transcript);
        setIsListening(false);
        setAudioLevel(0);
        handleSend(transcript);
      };
      recog.onerror = () => {
        setIsListening(false);
        setAudioLevel(0);
      };
      recog.onend = () => {
        setIsListening(false);
        setAudioLevel(0);
      };

      recog.start();
    } catch {
      setIsListening(false);
      setAudioLevel(0);
    }
  };

  const circadian = profile?.circadianState || "morning_chai";

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-zinc-950 text-zinc-100 font-sans">
      {/* 1. TOP LIVING COMPANION AVATAR STAGE */}
      <section className="relative shrink-0 border-b border-zinc-800/80 bg-zinc-950/90 p-3 sm:p-4 transition-all duration-500">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Living Avatar with AEIOU Lip-Sync & Micro-Animations */}
          <div className="flex items-center gap-4 w-full md:w-auto">
            <SaanLivingAvatar
              emotion={avatarEmotion}
              isSpeaking={isSpeaking}
              isListening={isListening}
              circadianState={circadian}
              bondStage={profile?.bondStage || "Soulbound"}
              bondScore={profile?.bondScore || 65}
              onPoke={() => setAvatarEmotion("blush")}
              onHeadpat={() => {
                setAvatarEmotion("blush");
                handleAffectionAction("headpat");
              }}
              onCheekPoke={() => {
                setAvatarEmotion("curious");
              }}
            />

            {/* Quick Interactive Affection Bar (HerAndHim) */}
            <div className="hidden lg:flex flex-col gap-2 pl-4 border-l border-zinc-800/80">
              <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                Companion Interaction
              </span>
              <SaanAffectionBar
                onTriggerAction={handleAffectionAction}
                bondScore={profile?.bondScore || 65}
              />
            </div>
          </div>

          {/* Airi Hearing Capsule + Chronicler & Mimir Tools */}
          <div className="flex flex-col items-center md:items-end gap-2 w-full md:w-auto">
            {/* Top Toolbar: Chronicler & Mimir Superchargers */}
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              {/* Mimir: Flashbulb Memory Vault */}
              <button
                type="button"
                onClick={() => setIsFlashbulbOpen(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition shadow-xs"
                title="View Flashbulb Memory Anchors (Never Decay)"
              >
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                <span>Flashbulb</span>
                {flashbulbMemories.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500/30 text-amber-200 font-mono font-bold">
                    {flashbulbMemories.length}
                  </span>
                )}
              </button>

              {/* Mimir: Huginn Thought Raven Insights */}
              <button
                type="button"
                onClick={() => setIsHuginnOpen(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 transition shadow-xs"
                title="View Huginn Emergent Trajectories & Patterns"
              >
                <Brain className="w-3.5 h-3.5 text-purple-400" />
                <span>Huginn Patterns</span>
                {huginnInsights.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-purple-500/30 text-purple-200 font-mono font-bold">
                    {huginnInsights.length}
                  </span>
                )}
              </button>

              {/* Chronicler: Promises / Consequence Ledger */}
              <button
                type="button"
                onClick={() => setIsLedgerOpen(true)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${
                  openDeedsCount > 0
                    ? "bg-amber-500/15 text-amber-300 border-amber-500/40 hover:bg-amber-500/25 animate-pulse"
                    : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200"
                }`}
                title="View Open Commitments and Consequence Ledger"
              >
                <BookmarkCheck className="w-3.5 h-3.5 text-amber-400" />
                <span>Promises</span>
                {openDeedsCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500/30 text-amber-200 font-mono font-bold">
                    {openDeedsCount}
                  </span>
                )}
              </button>

              {/* Chronicler: Previously On... Story Recap */}
              <button
                type="button"
                onClick={() => setIsRecapOpen(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-zinc-900 hover:bg-purple-950/40 text-purple-300 border border-zinc-800 hover:border-purple-500/40 transition"
                title="View Story Recap & Active Narrative Arcs"
              >
                <Film className="w-3.5 h-3.5 text-purple-400" />
                <span>Story Recap</span>
              </button>

              {/* Airi: Toggle Pomodoro Focus Widget */}
              <button
                type="button"
                onClick={() => setShowPomodoro((p) => !p)}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium border transition ${
                  showPomodoro
                    ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
                    : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200"
                }`}
                title="Toggle Focus Sprint Pomodoro Widget"
              >
                <Timer className="w-3 h-3 text-cyan-400" />
                <span>Sprint</span>
              </button>

              {/* Chronicler: Pacing Director Beat Trigger */}
              <button
                type="button"
                onClick={handleTriggerBeat}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-cyan-300 hover:border-cyan-500/40 transition"
                title="Inject Dynamic Conversational Beat (Break Deadlock)"
              >
                <Zap className="w-3 h-3 text-cyan-400" />
                <span className="hidden sm:inline">Nudge Beat</span>
              </button>

              {/* SillyTavern: Export Character Card V2 */}
              <button
                type="button"
                onClick={handleExportCard}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 transition cursor-pointer"
                title="Export Saan Persona as SillyTavern Character Card V2"
              >
                <Download className="w-3 h-3 text-emerald-400" />
                <span>Export CCv2</span>
              </button>

              {/* SillyTavern: Import Character Card V2/V3 */}
              <button
                type="button"
                onClick={handleImportCard}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 transition cursor-pointer"
                title="Import SillyTavern Character Card (JSON)"
              >
                <Upload className="w-3 h-3 text-indigo-400" />
                <span>Import Card</span>
              </button>

              {/* RisuAI: Live Token Budget Gauge */}
              {tokenBudget ? (
                <div
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-medium border transition ${
                    tokenBudget.inputTokens / tokenBudget.maxContextTokens > 0.85
                      ? "bg-rose-500/15 text-rose-300 border-rose-500/40 animate-pulse"
                      : tokenBudget.inputTokens / tokenBudget.maxContextTokens > 0.6
                      ? "bg-amber-500/15 text-amber-300 border-amber-500/40"
                      : "bg-emerald-500/15 text-emerald-300 border-emerald-500/40"
                  }`}
                  title={`Context Budget: ${tokenBudget.inputTokens} / ${tokenBudget.maxContextTokens} tok (${Math.round(
                    (tokenBudget.inputTokens / tokenBudget.maxContextTokens) * 100
                  )}%)\nRemaining Headroom: ${tokenBudget.headroomTokens}\nClamped Output: ${tokenBudget.outputTokens}${
                    tokenBudget.wasPruned ? " (Oldest Turns Pruned!)" : ""
                  }`}
                >
                  <Zap className="w-3 h-3 text-amber-400" />
                  <span>
                    {tokenBudget.inputTokens.toLocaleString()}/{tokenBudget.maxContextTokens.toLocaleString()}
                  </span>
                  {tokenBudget.wasPruned && (
                    <span className="px-1 py-0.2 rounded text-[9px] bg-rose-500/30 text-rose-200 font-bold">
                      PRUNED
                    </span>
                  )}
                </div>
              ) : (
                <div
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-mono text-zinc-400 bg-zinc-900 border border-zinc-800"
                  title="Context Budget: 8k Tokens Headroom Active"
                >
                  <Zap className="w-3 h-3 text-zinc-500" />
                  <span>8k Context</span>
                </div>
              )}

              {/* RisuAI: Provider Cascade Resilience Status */}
              <div
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-mono border transition ${
                  providerTelemetry.fallbackTriggered
                    ? "bg-amber-500/10 text-amber-300 border-amber-500/30"
                    : "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                }`}
                title={`Provider Cascade Telemetry: ${providerTelemetry.providerUsed} (Fallback: ${
                  providerTelemetry.fallbackTriggered ? "Triggered" : "Direct"
                })`}
              >
                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                <span className="hidden xl:inline truncate max-w-[120px]">{providerTelemetry.providerUsed}</span>
                <span className="xl:hidden">Cascade</span>
              </div>

              {/* RisuAI: Chat Variables Inspector Modal Trigger */}
              <button
                type="button"
                onClick={() => setIsVariablesOpen(true)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-zinc-900 hover:bg-purple-950/40 text-purple-300 border border-zinc-800 hover:border-purple-500/40 transition cursor-pointer"
                title="Inspect & Tune Live Chat Variables"
              >
                <span className="font-mono text-purple-400 font-bold">{"{x}"}</span>
                <span>Vars</span>
              </button>

              {/* RisuAI: Associative Graph Memory Modal Trigger */}
              <button
                type="button"
                onClick={() => setIsGraphOpen(true)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-zinc-900 hover:bg-cyan-950/40 text-cyan-300 border border-zinc-800 hover:border-cyan-500/40 transition cursor-pointer"
                title="Explore Associative Knowledge Graph (GraphMem)"
              >
                <Network className="w-3 h-3 text-cyan-400" />
                <span>GraphMem</span>
              </button>

              {/* Letta: Core Memory Pinned RAM Studio Drawer */}
              {(() => {
                const humanItem = coreMemSummary.find((s) => s.label === "human");
                const personaItem = coreMemSummary.find((s) => s.label === "persona");
                const totalChars =
                  (humanItem?.length || coreMemBlocks.human.length) +
                  (personaItem?.length || coreMemBlocks.persona.length);
                const maxTotal = (humanItem?.maxCapacity || 2500) + (personaItem?.maxCapacity || 2500);
                const pct = Math.round((totalChars / maxTotal) * 100);
                return (
                  <button
                    type="button"
                    onClick={() => setIsCoreMemOpen(true)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-medium border transition cursor-pointer ${
                      pct >= 80
                        ? "bg-rose-500/15 text-rose-300 border-rose-500/40 animate-pulse"
                        : pct >= 50
                        ? "bg-amber-500/15 text-amber-300 border-amber-500/40"
                        : "bg-purple-900/40 hover:bg-purple-900/60 text-purple-200 border-purple-500/40"
                    }`}
                    title={`Letta Core Memory Blocks (Pinned in RAM): ${totalChars}/${maxTotal} chars (${pct}%)\nClick to inspect or edit Human and Persona blocks.`}
                  >
                    <Brain className="w-3.5 h-3.5 text-purple-400" />
                    <span>CoreRAM: {pct}%</span>
                  </button>
                );
              })()}

              {/* Mem0: 4-State Mutation Matrix Inspector Modal Trigger */}
              <button
                type="button"
                onClick={() => setIsMem0Open(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-zinc-900 hover:bg-emerald-950/40 text-emerald-300 border border-zinc-800 hover:border-emerald-500/40 transition cursor-pointer"
                title="Inspect Mem0 4-State Mutation Matrix (ADD/UPDATE/DELETE/NONE)"
              >
                <Zap className="w-3.5 h-3.5 text-emerald-400" />
                <span>Mem0: {mem0Events.length}</span>
              </button>

              {/* Graphiti: Bi-Temporal Knowledge Graph & Contradiction Visualizer Trigger */}
              <button
                type="button"
                onClick={() => setIsGraphitiOpen(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-zinc-900 hover:bg-cyan-950/40 text-cyan-300 border border-zinc-800 hover:border-cyan-500/40 transition cursor-pointer"
                title="Explore Graphiti Bi-Temporal Knowledge Graph & Contradiction Visualizer"
              >
                <GitBranch className="w-3.5 h-3.5 text-cyan-400" />
                <span>Graphiti</span>
              </button>

              {/* Cognee: Cognify Multi-Stage Pipeline & Rollback Modal Trigger */}
              <button
                type="button"
                onClick={() => setIsCognifyOpen(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-zinc-900 hover:bg-purple-950/40 text-purple-300 border border-zinc-800 hover:border-purple-500/40 transition cursor-pointer"
                title="Inspect Cognee Multi-Stage Cognify Pipeline & Atomic Rollback Engine"
              >
                <Layers className="w-3.5 h-3.5 text-purple-400" />
                <span>Cognify</span>
              </button>

              {/* Hindsight: Knapsack Fact Budget & Temporal Query Modal Trigger */}
              <button
                type="button"
                onClick={() => setIsHindsightOpen(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-zinc-900 hover:bg-amber-950/40 text-amber-300 border border-zinc-800 hover:border-amber-500/40 transition cursor-pointer"
                title="Inspect Hindsight Knapsack Fact Budgeting & Temporal Query Engine"
              >
                <Briefcase className="w-3.5 h-3.5 text-amber-400" />
                <span>Hindsight</span>
              </button>

              {/* Datapace: Bi-Temporal Point-in-Time Scrubber Modal Trigger */}
              <button
                type="button"
                onClick={() => setIsTimeTravelOpen(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-zinc-900 hover:bg-sky-950/40 text-sky-300 border border-zinc-800 hover:border-sky-500/40 transition cursor-pointer"
                title="Scrub Point-in-Time Knowledge State (Datapace Engine)"
              >
                <Clock className="w-3.5 h-3.5 text-sky-400" />
                <span>Scrubber</span>
              </button>

              {/* Zep: Incremental Conversation Summary & Entity Tags Modal Trigger */}
              <button
                type="button"
                onClick={() => setIsSummaryOpen(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-zinc-900 hover:bg-indigo-950/40 text-indigo-300 border border-zinc-800 hover:border-indigo-500/40 transition cursor-pointer"
                title="Inspect Incremental Conversation Summary & Entity Tags (Zep / LangMem Engine)"
              >
                <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
                <span>Summary</span>
              </button>

              {/* Memobase: Categorical User Profile & Fact Merger Modal Trigger */}
              <button
                type="button"
                onClick={() => setIsProfileOpen(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-zinc-900 hover:bg-teal-950/40 text-teal-300 border border-zinc-800 hover:border-teal-500/40 transition cursor-pointer"
                title="Inspect Categorical User Profile & Fact Merger (Memobase Engine)"
              >
                <UserCheck className="w-3.5 h-3.5 text-teal-400" />
                <span>Profile</span>
              </button>

              {/* SuperAGI: Multi-Tier Memory Queue Buffer Inspector Modal Trigger */}
              <button
                type="button"
                onClick={() => setIsBufferedQueueOpen(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-zinc-900 hover:bg-cyan-950/40 text-cyan-300 border border-zinc-800 hover:border-cyan-500/40 transition cursor-pointer"
                title="Inspect Multi-Tier Write Buffer Queue (SuperAGI & TeleMem Engine)"
              >
                <Inbox className="w-3.5 h-3.5 text-cyan-400" />
                <span>Buffer{bufferedQueueCount > 0 ? `: ${bufferedQueueCount}` : ""}</span>
              </button>

              {/* Dify & Gnosys: Portable Memory Interchange Modal Trigger */}
              <button
                type="button"
                onClick={() => setIsPortableMemoryOpen(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-zinc-900 hover:bg-emerald-950/40 text-emerald-300 border border-zinc-800 hover:border-emerald-500/40 transition cursor-pointer"
                title="Sovereign Memory Snapshot Interchange (Gnosys & Dify Spec)"
              >
                <HardDriveDownload className="w-3.5 h-3.5 text-emerald-400" />
                <span>Interchange</span>
              </button>

              {/* MemGPT v2: Ephemeral Working Scratchpad Modal Trigger */}
              <button
                type="button"
                onClick={() => setIsScratchpadOpen(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-zinc-900 hover:bg-purple-950/40 text-purple-300 border border-zinc-800 hover:border-purple-500/40 transition cursor-pointer"
                title="Inspect Live Working Scratchpad & Multi-Step Reasoning Trace (MemGPT v2 Engine)"
              >
                <BrainCircuit className="w-3.5 h-3.5 text-purple-400" />
                <span>Scratchpad</span>
              </button>

              {/* OpenHands: Visual Action Execution Timeline Modal Trigger */}
              <button
                type="button"
                onClick={() => setIsActionTimelineOpen(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-zinc-900 hover:bg-orange-950/40 text-orange-300 border border-zinc-800 hover:border-orange-500/40 transition cursor-pointer"
                title="Inspect Visual Action Execution Timeline (OpenHands Engine)"
              >
                <Activity className="w-3.5 h-3.5 text-orange-400" />
                <span>Timeline</span>
              </button>

              {/* AutoGPT: Dirty JSON Repair Debug Drawer Modal Trigger */}
              <button
                type="button"
                onClick={() => setIsJsonDebugOpen(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-zinc-900 hover:bg-emerald-950/40 text-emerald-300 border border-zinc-800 hover:border-emerald-500/40 transition cursor-pointer"
                title="Inspect Dirty JSON Repair Drawer & Split View (AutoGPT & Agent Zero Engine)"
              >
                <Wrench className="w-3.5 h-3.5 text-emerald-400" />
                <span>JsonRepair</span>
              </button>

              {/* TriggerRecall: Proactive Morning Chai & Evening Unwind Modal Trigger */}
              <button
                type="button"
                onClick={() => setIsProactiveTriggerOpen(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-zinc-900 hover:bg-amber-950/40 text-amber-300 border border-zinc-800 hover:border-amber-500/40 transition cursor-pointer"
                title="Proactive Morning Chai & Evening Unwind Active Hours Manager (TriggerRecall Engine)"
              >
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                <span>Proactive</span>
              </button>

              {/* MemoryEvalJudge: Ground-Truth Memory Fidelity Judge & Telemetry Trigger */}
              <button
                type="button"
                onClick={() => setIsMemoryEvalJudgeOpen(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-zinc-900 hover:bg-cyan-950/40 text-cyan-300 border border-zinc-800 hover:border-cyan-500/40 transition cursor-pointer"
                title="Inspect Ground-Truth Memory Fidelity Judge & Multi-Metric Telemetry (MemoryEvalJudge Engine)"
              >
                <Scale className="w-3.5 h-3.5 text-cyan-400" />
                <span>EvalJudge</span>
              </button>

              {/* AssociativeMemory: Spreading Activation Graph Network Trigger */}
              <button
                type="button"
                onClick={() => setIsAssociativeNetworkOpen(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-zinc-900 hover:bg-violet-950/40 text-violet-300 border border-zinc-800 hover:border-violet-500/40 transition cursor-pointer"
                title="Inspect Spreading Activation Cognitive Graph & Concept Clusters (AssociativeMemory Engine)"
              >
                <Workflow className="w-3.5 h-3.5 text-violet-400" />
                <span>AssocWeb</span>
              </button>

              {/* CrewAI: Distributed State Lease & Mutex Manager Trigger */}
              <button
                type="button"
                onClick={() => setIsStateLeaseOpen(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-zinc-900 hover:bg-teal-950/40 text-teal-300 border border-zinc-800 hover:border-teal-500/40 transition cursor-pointer"
                title="Inspect Distributed State Lease Mutex & Fencing Tokens (CrewAI Engine)"
              >
                <Lock className="w-3.5 h-3.5 text-teal-400" />
                <span>LeaseLock</span>
              </button>

              {/* LangGraph: Cyclic Multi-Agent Research Planner Trigger */}
              <button
                type="button"
                onClick={() => setIsResearchWorkflowOpen(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-zinc-900 hover:bg-indigo-950/40 text-indigo-300 border border-zinc-800 hover:border-indigo-500/40 transition cursor-pointer"
                title="Inspect Cyclic Multi-Agent Research Planner & Checkpoints (LangGraph Engine)"
              >
                <Compass className="w-3.5 h-3.5 text-indigo-400" />
                <span>Planner</span>
              </button>

              {/* Smolagents: Interactive Confirmation Gate Trigger */}
              <button
                type="button"
                onClick={() => setIsGateModalOpen(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-zinc-900 hover:bg-amber-950/40 text-amber-300 border border-zinc-800 hover:border-amber-500/40 transition cursor-pointer"
                title="Inspect 3-Tier Interactive Confirmation Gate & Sandboxed Execution (Smolagents Engine)"
              >
                <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                <span>ConfGate</span>
                {pendingGateCount > 0 && (
                  <span className="ml-0.5 px-1 py-0.2 rounded-full text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    {pendingGateCount}
                  </span>
                )}
              </button>

              {/* AutoGen: Idempotency Backoff Retry Telemetry Trigger */}
              <button
                type="button"
                onClick={() => setIsRetryTelemetryOpen(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-zinc-900 hover:bg-cyan-950/40 text-cyan-300 border border-zinc-800 hover:border-cyan-500/40 transition cursor-pointer"
                title="Inspect AutoGen & n8n Idempotency Backoff, DLQ & Latency Telemetry"
              >
                <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
                <span>Backoff</span>
                {activeRetryCount > 0 && (
                  <span className="ml-0.5 px-1 py-0.2 rounded-full text-[9px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                    {activeRetryCount}
                  </span>
                )}
              </button>

              {/* Huginn: Agent Lifecycle Hooks Registry Trigger */}
              <button
                type="button"
                onClick={() => setIsLifecycleHookOpen(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-zinc-900 hover:bg-purple-950/40 text-purple-300 border border-zinc-800 hover:border-purple-500/40 transition cursor-pointer"
                title="Inspect Huginn Agent Lifecycle Hooks Registry & Execution Monitor"
              >
                <Webhook className="w-3.5 h-3.5 text-purple-400" />
                <span>Hooks</span>
                {activeHookCount > 0 && (
                  <span className="ml-0.5 px-1 py-0.2 rounded-full text-[9px] bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    {activeHookCount}
                  </span>
                )}
              </button>

              {/* SearXNG & Khoj: Privacy Metasearch & Query Decomposition Trigger */}
              <button
                type="button"
                onClick={() => setIsMetasearchOpen(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-zinc-900 hover:bg-blue-950/40 text-blue-300 border border-zinc-800 hover:border-blue-500/40 transition cursor-pointer"
                title="Inspect SearXNG & Khoj Privacy Metasearch & Query Decomposition (Repos #29 & #30)"
              >
                <Globe className="w-3.5 h-3.5 text-blue-400" />
                <span>MetaSearch</span>
              </button>
            </div>

            {/* Airi: Real-Time Hearing Status Capsule with VU Spectrum */}
            <div className="flex items-center gap-2">
              <SaanHearingStatusCapsule
                isListening={isListening}
                isSpeaking={isSpeaking}
                audioLevel={audioLevel}
                onToggleMic={toggleListening}
              />

              {ttfaMs && (
                <span className="text-[10px] text-zinc-400 font-mono bg-zinc-900/80 px-2 py-1 rounded-xl border border-zinc-800">
                  TTFA: {ttfaMs}ms
                </span>
              )}

              {/* TTS Voice Toggle */}
              <button
                type="button"
                onClick={() => setVoiceEnabled((p) => !p)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-medium border transition ${
                  voiceEnabled
                    ? "bg-purple-600/30 text-purple-300 border-purple-500/50"
                    : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200"
                }`}
                title="Toggle Auto-Voice Speech Synthesis"
              >
                {voiceEnabled ? <Volume2 className="h-3 w-3" /> : <VolumeX className="h-3 w-3" />}
                <span>Auto Voice</span>
              </button>

              <button
                type="button"
                onClick={() => onNavigateTab?.("persona")}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-medium bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-zinc-200 hover:border-zinc-700 transition"
                title="Open Persona & Lorebook Studio"
              >
                <Sliders className="h-3 w-3 text-purple-400" />
                <span className="hidden sm:inline">Persona Studio</span>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Affection Bar (Visible on smaller screens) */}
        <div className="flex lg:hidden mt-3 pt-2.5 border-t border-zinc-800/60 justify-center">
          <SaanAffectionBar
            onTriggerAction={handleAffectionAction}
            bondScore={profile?.bondScore || 65}
          />
        </div>

        {/* Airi Interactive Calling Component: Focus Sprint Pomodoro Widget */}
        {showPomodoro && (
          <div className="max-w-4xl mx-auto mt-3 animate-in fade-in duration-300">
            <SaanPomodoroWidget
              onSessionComplete={(mins) =>
                handleSend(
                  `*Celebrates with Saan* Humne ${mins} minutes ka Deep Focus Sprint successfully complete kar liya!`
                )
              }
            />
          </div>
        )}
      </section>

      {/* 2. CHAT STREAM AREA */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4 max-w-4xl mx-auto w-full"
      >
        {/* Dynamic Starter Prompts */}
        {starterChips.length > 0 && messages.length <= 2 && (
          <div className="space-y-2 p-3 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 mb-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-400">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Suggested Starters</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {starterChips.map((chip, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSend(chip)}
                  className="px-3 py-1 rounded-xl text-xs bg-zinc-900 hover:bg-purple-900/30 text-zinc-300 hover:text-purple-200 border border-zinc-800 hover:border-purple-500/40 transition active:scale-95 text-left"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Enhanced SillyTavern + HerAndHim Messages */}
        {messages.map((m) => (
          <SaanDialogueBubble
            key={m.id}
            message={m}
            onSpeak={(text) => speakText(text, m.id)}
            onReact={handleUserReaction}
            onRollback={handleRollback}
            onSwipeAlternative={handleSwipeAlternative}
            onRegenerateSwipe={handleRegenerateSwipe}
          />
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-xs text-purple-400 p-2 font-medium">
            <span className="h-2 w-2 rounded-full bg-purple-500 animate-ping" />
            <span>Saan is typing her thoughts...</span>
          </div>
        )}
      </div>

      {/* 3. WORKING MEMORY CAPSULE & INPUT BAR */}
      <footer className="p-3 sm:p-4 border-t border-zinc-800/80 bg-zinc-950/95 backdrop-blur-md shrink-0 space-y-2">
        {/* Active Letta Working Memory Pill */}
        <SaanWorkingMemoryCapsule
          workingMemoryText={
            profile?.bio ||
            "Krishna is building sovereign K7 OS, loves masala chai, prefers deep modular code."
          }
          moodLabel={profile?.mood || "Affectionate"}
          circadianLabel={circadian}
          onOpenMemoryVault={() => onNavigateTab?.("graph")}
        />

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="max-w-4xl mx-auto flex items-center gap-2"
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder="Type a message or whisper something to Saan..."
            disabled={loading}
            className="flex-1 bg-zinc-900 border border-zinc-800 focus:border-purple-500 rounded-xl px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-purple-500 transition"
          />

          <button
            type="button"
            onClick={toggleListening}
            className={`p-2.5 rounded-xl border transition ${
              isListening
                ? "bg-emerald-600 text-white border-emerald-500 animate-pulse"
                : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-100 hover:bg-zinc-800"
            }`}
            title="Speech to Text"
          >
            {isListening ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
          </button>

          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-medium text-sm transition flex items-center gap-1.5 shadow-sm active:scale-95"
          >
            <span>Send</span>
            <Send className="h-3.5 w-3.5" />
          </button>
        </form>
      </footer>

      {/* Chronicler Modals */}
      <SaanConsequenceTracker
        deeds={deeds}
        isOpen={isLedgerOpen}
        onClose={() => setIsLedgerOpen(false)}
        onRefresh={() => onRefreshSoul?.()}
      />

      <SaanStoryRecapModal
        isOpen={isRecapOpen}
        onClose={() => setIsRecapOpen(false)}
        storyRecap={storyRecap}
        activeArcs={activeArcs}
        openDeedsCount={openDeedsCount}
        onResumeChat={(text) => handleSend(text)}
      />

      {/* Mimir Neuro-Cognitive Modals */}
      <SaanFlashbulbVault
        isOpen={isFlashbulbOpen}
        onClose={() => setIsFlashbulbOpen(false)}
        memories={flashbulbMemories}
        onRelive={handleReliveMemory}
        onRefresh={() => onRefreshSoul?.()}
      />

      <SaanHuginnRavenDashboard
        isOpen={isHuginnOpen}
        onClose={() => setIsHuginnOpen(false)}
        insights={huginnInsights}
        onTriggerScan={() => onRefreshSoul?.()}
        onFollowUp={(topic) => handleSend(`Saan, aao is baare mein baat karte hain: "${topic}"`)}
      />

      {/* RisuAI Chat Variables Inspector Modal */}
      {isVariablesOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <header className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/60">
              <div className="flex items-center gap-2">
                <span className="font-mono text-purple-400 font-bold text-lg">{"{ x }"}</span>
                <div>
                  <h3 className="text-base font-semibold text-zinc-100">RisuAI Chat Variables Inspector</h3>
                  <p className="text-xs text-zinc-400">Persistent session variables evaluated in prompt macros</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsVariablesOpen(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </header>

            <div className="p-4 overflow-y-auto space-y-3 flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {Object.entries(chatVariables).map(([key, value]) => {
                  const isNum = typeof value === "number";
                  const isBool = typeof value === "boolean";
                  return (
                    <div
                      key={key}
                      className="p-3 rounded-xl bg-zinc-950/50 border border-zinc-800/80 flex items-center justify-between gap-3 hover:border-purple-500/30 transition"
                    >
                      <div className="min-w-0">
                        <span className="text-[11px] font-mono text-purple-400 font-bold block truncate">
                          {"{{" + key + "}}"}
                        </span>
                        <span className="text-sm font-medium text-zinc-200 truncate block">
                          {String(value)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {isNum && (
                          <button
                            type="button"
                            onClick={() => handleIncrementVariable(key, 1)}
                            className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 transition"
                            title="Increment +1"
                          >
                            +1
                          </button>
                        )}
                        {isBool && (
                          <button
                            type="button"
                            onClick={() => handleToggleVariable(key)}
                            className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 transition"
                            title="Toggle Boolean"
                          >
                            Toggle
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Add New Variable Form */}
              <div className="mt-4 pt-3 border-t border-zinc-800/80 flex flex-col sm:flex-row gap-2 items-center">
                <input
                  type="text"
                  placeholder="variable_name"
                  value={newVarKey}
                  onChange={(e) => setNewVarKey(e.target.value)}
                  className="w-full sm:w-1/3 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 font-mono focus:outline-none focus:border-purple-500"
                />
                <input
                  type="text"
                  placeholder="value (string, number, or boolean)"
                  value={newVarVal}
                  onChange={(e) => setNewVarVal(e.target.value)}
                  className="w-full sm:flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-purple-500"
                />
                <button
                  type="button"
                  onClick={() => {
                    let val: any = newVarVal;
                    if (val === "true") val = true;
                    else if (val === "false") val = false;
                    else if (!isNaN(Number(val)) && val.trim() !== "") val = Number(val);
                    handleSetVariable(newVarKey, val);
                  }}
                  disabled={!newVarKey.trim()}
                  className="w-full sm:w-auto px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-xs font-medium flex items-center justify-center gap-1 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Set</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RisuAI Associative Knowledge Graph (GraphMem) Modal */}
      {isGraphOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-3xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <header className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/60">
              <div className="flex items-center gap-2">
                <Network className="w-5 h-5 text-cyan-400" />
                <div>
                  <h3 className="text-base font-semibold text-zinc-100">Associative Entity Graph (GraphMem)</h3>
                  <p className="text-xs text-zinc-400">Multi-hop BFS relational memory network linking Saan's core knowledge</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsGraphOpen(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </header>

            {/* Search Bar */}
            <div className="p-4 border-b border-zinc-800/80 bg-zinc-950/40">
              <div className="relative">
                <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search entities or topics (e.g., 'Krishna', 'Phryvos', 'Chai')..."
                  value={graphQuery}
                  onChange={(e) => handleSearchGraph(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-4 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-cyan-500 transition"
                />
              </div>
            </div>

            {/* Graph Node Cards Grid */}
            <div className="p-4 overflow-y-auto space-y-3 flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {graphSearchResults.map((node, idx) => (
                  <div
                    key={node.name || idx}
                    className="p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-800/80 hover:border-cyan-500/40 transition flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-bold text-cyan-300 font-mono flex items-center gap-1.5">
                          <Database className="w-3.5 h-3.5 text-cyan-400" />
                          {node.name}
                        </span>
                        <span className="text-[10px] text-zinc-500 font-mono">
                          {node.connections?.length || 0} links
                        </span>
                      </div>
                      <p className="text-xs text-zinc-300 leading-relaxed mb-3">
                        {node.summary}
                      </p>
                    </div>

                    {/* Connected Edge Badges */}
                    {node.connections && node.connections.length > 0 && (
                      <div className="pt-2 border-t border-zinc-800/50 flex flex-wrap gap-1">
                        <span className="text-[10px] text-zinc-500 font-mono mr-1">Edges:</span>
                        {node.connections.map((conn: string) => (
                          <button
                            key={conn}
                            type="button"
                            onClick={() => handleSearchGraph(conn)}
                            className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-cyan-950/60 text-cyan-300 border border-cyan-800/40 hover:bg-cyan-900/60 transition"
                          >
                            {conn}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {graphSearchResults.length === 0 && (
                <div className="text-center py-12 text-zinc-500 text-xs">
                  No matching graph entities found for &quot;{graphQuery}&quot;.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Letta Core Memory Blocks Studio Modal */}
      {isCoreMemOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-4xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <header className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/60">
              <div className="flex items-center gap-2.5">
                <Brain className="w-5 h-5 text-purple-400" />
                <div>
                  <h3 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
                    <span>Letta Core Memory Blocks (RAM)</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      In-Context Pinned
                    </span>
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Always present inside Saan&apos;s system prompt. Autonomously self-edited by Saan and editable by you.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCoreMemOpen(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </header>

            <div className="p-4 overflow-y-auto space-y-5 flex-1">
              {/* Dual Blocks Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Human Block */}
                <div className="rounded-xl bg-zinc-950/70 border border-zinc-800 p-4 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-bold text-zinc-200 flex items-center gap-1.5 font-mono">
                        <User className="w-4 h-4 text-cyan-400" />
                        {"<human_profile>"} (Krishna)
                      </span>
                      {(() => {
                        const len = coreMemBlocks.human.length;
                        const pct = Math.round((len / 2500) * 100);
                        return (
                          <span
                            className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded ${
                              pct >= 80
                                ? "bg-rose-500/20 text-rose-300"
                                : pct >= 50
                                ? "bg-amber-500/20 text-amber-300"
                                : "bg-emerald-500/20 text-emerald-300"
                            }`}
                          >
                            {len}/2500 chars ({pct}%)
                          </span>
                        );
                      })()}
                    </div>
                    <p className="text-[11px] text-zinc-400 mb-2">
                      Verified facts, preferences, habits, and constraints about you. Saan never forgets these.
                    </p>
                    <textarea
                      rows={9}
                      value={coreMemBlocks.human}
                      onChange={(e) =>
                        setCoreMemBlocks((prev) => ({ ...prev, human: e.target.value }))
                      }
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-xs text-zinc-100 focus:outline-none focus:border-cyan-500 font-mono leading-relaxed"
                      placeholder="Add facts about yourself..."
                    />
                  </div>
                  {/* Progress Bar */}
                  <div className="w-full bg-zinc-900 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        coreMemBlocks.human.length > 2000
                          ? "bg-rose-500"
                          : coreMemBlocks.human.length > 1250
                          ? "bg-amber-500"
                          : "bg-cyan-500"
                      }`}
                      style={{
                        width: `${Math.min(100, (coreMemBlocks.human.length / 2500) * 100)}%`,
                      }}
                    />
                  </div>
                </div>

                {/* 2. Persona Block */}
                <div className="rounded-xl bg-zinc-950/70 border border-zinc-800 p-4 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-bold text-zinc-200 flex items-center gap-1.5 font-mono">
                        <Sparkles className="w-4 h-4 text-pink-400" />
                        {"<persona_identity>"} (Saan)
                      </span>
                      {(() => {
                        const len = coreMemBlocks.persona.length;
                        const pct = Math.round((len / 2500) * 100);
                        return (
                          <span
                            className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded ${
                              pct >= 80
                                ? "bg-rose-500/20 text-rose-300"
                                : pct >= 50
                                ? "bg-amber-500/20 text-amber-300"
                                : "bg-emerald-500/20 text-emerald-300"
                            }`}
                          >
                            {len}/2500 chars ({pct}%)
                          </span>
                        );
                      })()}
                    </div>
                    <p className="text-[11px] text-zinc-400 mb-2">
                      Saan&apos;s sovereign identity, core values, authentic speech patterns, and boundary rules.
                    </p>
                    <textarea
                      rows={9}
                      value={coreMemBlocks.persona}
                      onChange={(e) =>
                        setCoreMemBlocks((prev) => ({ ...prev, persona: e.target.value }))
                      }
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-xs text-zinc-100 focus:outline-none focus:border-pink-500 font-mono leading-relaxed"
                      placeholder="Define Saan's identity..."
                    />
                  </div>
                  {/* Progress Bar */}
                  <div className="w-full bg-zinc-900 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        coreMemBlocks.persona.length > 2000
                          ? "bg-rose-500"
                          : coreMemBlocks.persona.length > 1250
                          ? "bg-amber-500"
                          : "bg-pink-500"
                      }`}
                      style={{
                        width: `${Math.min(100, (coreMemBlocks.persona.length / 2500) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Revision Audit Log */}
              <div className="rounded-xl bg-zinc-950/50 border border-zinc-800 p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-300 flex items-center gap-1.5 font-mono">
                    <History className="w-3.5 h-3.5 text-purple-400" />
                    Self-Editing Revision Audit Log ({coreMemHistory.length} events)
                  </span>
                  <span className="text-[10px] text-zinc-500 font-mono">Real-time RAM trace</span>
                </div>
                <div className="max-h-32 overflow-y-auto space-y-1.5 pr-1">
                  {coreMemHistory.map((ev: any, idx: number) => (
                    <div
                      key={ev.id || idx}
                      className="text-[11px] font-mono p-2 rounded bg-zinc-900/60 border border-zinc-800/60 flex items-center justify-between text-zinc-300"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span
                          className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                            ev.author === "saan"
                              ? "bg-purple-500/30 text-purple-200"
                              : "bg-cyan-500/30 text-cyan-200"
                          }`}
                        >
                          {ev.author?.toUpperCase() || "SYSTEM"}
                        </span>
                        <span className="text-purple-300">[{ev.block}]</span>
                        <span className="truncate">{ev.diffSummary}</span>
                      </div>
                      <span className="text-[10px] text-zinc-500 shrink-0 ml-2">
                        {new Date(ev.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  ))}
                  {coreMemHistory.length === 0 && (
                    <p className="text-xs text-zinc-500 py-2 text-center">No self-edits recorded yet.</p>
                  )}
                </div>
              </div>
            </div>

            <footer className="p-4 border-t border-zinc-800 bg-zinc-950/80 flex items-center justify-between">
              <span className="text-xs text-zinc-400">
                Changes will instantly update Saan&apos;s active system prompt for subsequent turns.
              </span>
              <button
                type="button"
                onClick={handleSaveCoreMemoryFromStage}
                disabled={coreMemSaving}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-medium text-xs flex items-center gap-1.5 transition shadow-sm active:scale-95"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{coreMemSaving ? "Saving..." : "Save to System Prompt RAM"}</span>
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* Mem0 4-State Mutation Matrix Modal */}
      {isMem0Open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-3xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <header className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/60">
              <div className="flex items-center gap-2.5">
                <Zap className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
                    <span>Mem0 4-State Mutation Matrix</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Live Stream
                    </span>
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Real-time memory resolution engine: ADD (novel), UPDATE (refinement), DELETE (contradiction), NONE (duplicate).
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsMem0Open(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </header>

            {/* Filter Tabs */}
            <div className="px-4 py-2.5 border-b border-zinc-800 bg-zinc-950/40 flex items-center gap-2">
              {(["ALL", "ADD", "UPDATE", "DELETE", "NONE"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setMem0Filter(tab)}
                  className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition ${
                    mem0Filter === tab
                      ? tab === "ADD"
                        ? "bg-emerald-500 text-black"
                        : tab === "UPDATE"
                        ? "bg-amber-500 text-black"
                        : tab === "DELETE"
                        ? "bg-rose-500 text-white"
                        : "bg-purple-600 text-white"
                      : "bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Event List */}
            <div className="p-4 overflow-y-auto space-y-2.5 flex-1">
              {mem0Events
                .filter((ev) => mem0Filter === "ALL" || ev.event === mem0Filter)
                .map((ev, idx) => (
                  <div
                    key={ev.id || idx}
                    className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80 hover:border-emerald-500/30 transition flex flex-col gap-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                            ev.event === "ADD"
                              ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                              : ev.event === "UPDATE"
                              ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                              : ev.event === "DELETE"
                              ? "bg-rose-500/20 text-rose-300 border-rose-500/30"
                              : "bg-zinc-800 text-zinc-400 border-zinc-700"
                          }`}
                        >
                          {ev.event === "ADD"
                            ? "➕ ADD"
                            : ev.event === "UPDATE"
                            ? "🔄 UPDATE"
                            : ev.event === "DELETE"
                            ? "❌ DELETE"
                            : "⚪ NONE"}
                        </span>
                        <span className="text-xs text-zinc-500 font-mono">
                          {ev.userId ? `User: ${ev.userId}` : ""}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-zinc-500">
                        {new Date(ev.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </span>
                    </div>

                    <p className="text-xs text-zinc-200 font-medium leading-relaxed">
                      {ev.memory}
                    </p>
                  </div>
                ))}

              {mem0Events.filter((ev) => mem0Filter === "ALL" || ev.event === mem0Filter).length === 0 && (
                <div className="text-center py-12 text-zinc-500 text-xs">
                  No {mem0Filter !== "ALL" ? mem0Filter : ""} mutation events recorded in buffer.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Graphiti Bi-Temporal Knowledge Graph & Contradiction Modal */}
      <SaanTemporalGraphModal
        isOpen={isGraphitiOpen}
        onClose={() => setIsGraphitiOpen(false)}
      />

      {/* Cognee Cognify Multi-Stage Pipeline Modal */}
      <SaanCognifyPipelineModal
        isOpen={isCognifyOpen}
        onClose={() => setIsCognifyOpen(false)}
      />

      {/* Hindsight Knapsack Fact Budget Modal */}
      <SaanHindsightBudgetModal
        isOpen={isHindsightOpen}
        onClose={() => setIsHindsightOpen(false)}
      />

      {/* Datapace Point-in-Time Scrubber Modal */}
      <SaanTimeTravelScrubberModal
        isOpen={isTimeTravelOpen}
        onClose={() => setIsTimeTravelOpen(false)}
      />

      {/* Zep / LangMem Incremental Summary Modal */}
      <SaanIncrementalSummaryModal
        isOpen={isSummaryOpen}
        onClose={() => setIsSummaryOpen(false)}
      />

      {/* Memobase Categorical User Profile Modal */}
      <SaanProfileExtractorModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
      />

      {/* SuperAGI Multi-Tier Write Buffer Inspector Modal */}
      <SaanBufferedQueueModal
        isOpen={isBufferedQueueOpen}
        onClose={() => setIsBufferedQueueOpen(false)}
        onQueueUpdated={() => {
          fetch("/api/saan/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: "get_buffered_queue_status" }),
          })
            .then((r) => r.json())
            .then((d) => {
              if (d.ok && d.metrics) setBufferedQueueCount(d.metrics.totalPending);
            })
            .catch(() => {});
        }}
      />

      {/* Gnosys & Dify Sovereign Memory Interchange Modal */}
      <SaanPortableMemoryModal
        isOpen={isPortableMemoryOpen}
        onClose={() => setIsPortableMemoryOpen(false)}
        onMemoryImported={() => {
          // Re-fetch Core Memory and Profile
          fetch("/api/saan/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: "letta_summary" }),
          })
            .then((r) => r.json())
            .then((d) => {
              if (d.ok && d.blocks) setCoreMemBlocks(d.blocks);
            })
            .catch(() => {});
        }}
      />

      {/* MemGPT v2 Ephemeral Working Scratchpad Modal */}
      <SaanWorkingScratchpadModal
        isOpen={isScratchpadOpen}
        onClose={() => setIsScratchpadOpen(false)}
      />

      {/* OpenHands Observable Action Stream Timeline Modal */}
      <SaanActionTimelineModal
        isOpen={isActionTimelineOpen}
        onClose={() => setIsActionTimelineOpen(false)}
      />

      {/* AutoGPT Dirty JSON Repair Debug Drawer Modal */}
      <SaanDirtyJsonDebugModal
        isOpen={isJsonDebugOpen}
        onClose={() => setIsJsonDebugOpen(false)}
      />

      {/* TriggerRecall Proactive Morning Chai & Evening Unwind Modal */}
      <SaanProactiveTriggerModal
        isOpen={isProactiveTriggerOpen}
        onClose={() => setIsProactiveTriggerOpen(false)}
      />

      {/* MemoryEvalJudge Ground Truth Memory Evaluator Modal */}
      <SaanMemoryEvalJudgeModal
        isOpen={isMemoryEvalJudgeOpen}
        onClose={() => setIsMemoryEvalJudgeOpen(false)}
      />

      {/* AssociativeMemory Spreading Activation Network Modal */}
      <SaanAssociativeNetworkModal
        isOpen={isAssociativeNetworkOpen}
        onClose={() => setIsAssociativeNetworkOpen(false)}
      />

      {/* CrewAI Distributed State Lease Mutex Modal */}
      <SaanStateLeaseModal
        isOpen={isStateLeaseOpen}
        onClose={() => setIsStateLeaseOpen(false)}
      />

      {/* LangGraph Cyclic Multi-Agent Research Planner Modal */}
      <SaanResearchWorkflowModal
        isOpen={isResearchWorkflowOpen}
        onClose={() => setIsResearchWorkflowOpen(false)}
      />

      {/* Smolagents Interactive Confirmation Gate Modal */}
      <SaanConfirmationGateModal
        isOpen={isGateModalOpen}
        onClose={() => setIsGateModalOpen(false)}
        onPendingCountChange={(cnt) => setPendingGateCount(cnt)}
      />

      {/* AutoGen Resilient Retry & Idempotency Telemetry Modal */}
      <SaanRetryTelemetryModal
        isOpen={isRetryTelemetryOpen}
        onClose={() => setIsRetryTelemetryOpen(false)}
        onActiveRetriesChange={(cnt) => setActiveRetryCount(cnt)}
      />

      {/* Huginn Agent Lifecycle Hooks Registry Modal */}
      <SaanLifecycleHookModal
        isOpen={isLifecycleHookOpen}
        onClose={() => setIsLifecycleHookOpen(false)}
        onActiveHooksChange={(cnt) => setActiveHookCount(cnt)}
      />

      {/* SearXNG & Khoj Privacy Metasearch Modal */}
      <SaanMetasearchCitationModal
        isOpen={isMetasearchOpen}
        onClose={() => setIsMetasearchOpen(false)}
      />
    </div>
  );
}
