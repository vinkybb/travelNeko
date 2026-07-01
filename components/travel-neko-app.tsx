"use client";

import {
  ChangeEvent,
  FormEvent,
  MouseEvent as ReactMouseEvent,
  useCallback,
  useEffect,
  useRef,
  useState
} from "react";

import type { ChatMessage, JourneyRecord, JourneyResponse } from "../lib/types";
import { ChatWindow } from "./chat-window";

type PublicConfig = JourneyResponse["config"];

type TravelNekoAppProps = {
  initialRecords: JourneyRecord[];
  config: PublicConfig;
};

type GameView = "title" | "world";
type DemoMode = "explore" | "dialogue" | "archive" | "auto-kiosk";

type MapPosition = {
  x: number;
  y: number;
};

type Zone = {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  x: number;
  y: number;
  accent: string;
};

type NpcCat = {
  id: string;
  alias: string;
  role: string;
  zoneId: string;
  landmark: string;
  summary: string;
  mood: string;
  travelStyle: string;
  actionIdea: string;
  x: number;
  y: number;
  body: string;
  accent: string;
};

const WALK_DURATION_MS = 880;

/** Keep in sync with app/api/journey/route.ts cap on imageDataUrl. */
const MAX_IMAGE_DATA_URL_CHARS = 2_500_000;

const zones: Zone[] = [
  {
    id: "harbor",
    name: "雾灯港",
    subtitle: "咸味海风与鱼灯柱",
    description: "适合遇见会讲传说的港口猫，也常有第一段故事在这里展开。",
    x: 17,
    y: 70,
    accent: "#ec8c46"
  },
  {
    id: "market",
    name: "彩旗集市",
    subtitle: "桥边摊位与明信片",
    description: "热闹、鲜亮、很适合让画师猫把偶遇画成纪念物。",
    x: 37,
    y: 40,
    accent: "#4370b8"
  },
  {
    id: "windmill",
    name: "风车坡",
    subtitle: "高处瞭望与风信标",
    description: "适合侦察猫布置开场，也适合主角自己走动找线索。",
    x: 72,
    y: 22,
    accent: "#2e7f78"
  },
  {
    id: "old-street",
    name: "月影旧街",
    subtitle: "雨巷与谜语",
    description: "旧街常有神谕猫的暗线提示，也有别的猫突然插话。",
    x: 58,
    y: 77,
    accent: "#8e3b52"
  },
  {
    id: "archive-house",
    name: "纸灯书屋",
    subtitle: "手账与归档台",
    description: "故事收尾和记忆留存大多在这里落笔。",
    x: 84,
    y: 55,
    accent: "#6f593e"
  }
];

const npcCats: NpcCat[] = [
  {
    id: "companion-cat",
    alias: "伴猫",
    role: "港口搭子",
    zoneId: "harbor",
    landmark: "老码头鱼灯柱",
    summary: "最会把闲聊聊成冒险邀约的猫，遇见它时总会多出一条支线。",
    mood: "期待交朋友",
    travelStyle: "边走边收集传说",
    actionIdea: "先和它打个招呼，再问问港口最近最值得追的传说。",
    x: 18,
    y: 66,
    body: "#ec8c46",
    accent: "#fff1b6"
  },
  {
    id: "painter-cat",
    alias: "画师猫",
    role: "明信片画匠",
    zoneId: "market",
    landmark: "水彩摊位",
    summary: "会一边说话一边把眼前的场景改写成明信片构图。",
    mood: "兴奋又想收藏瞬间",
    travelStyle: "看到有趣场景就停下来画两笔",
    actionIdea: "想请它推荐最适合入画的角落，也想听听它最近画到了谁。",
    x: 36,
    y: 34,
    body: "#4370b8",
    accent: "#fff1bc"
  },
  {
    id: "scout-cat",
    alias: "侦察猫",
    role: "风车瞭望员",
    zoneId: "windmill",
    landmark: "高塔风信标",
    summary: "总会先看风向和远处的亮点，再决定这段旅程的开场。",
    mood: "有点紧张但兴奋",
    travelStyle: "走到高处先观察全景",
    actionIdea: "想跟它一起爬上风车坡，看看今天的远处有没有新鲜动静。",
    x: 72,
    y: 18,
    body: "#2e7f78",
    accent: "#ffe6a0"
  },
  {
    id: "oracle-cat",
    alias: "神谕猫",
    role: "旧街占卜师",
    zoneId: "old-street",
    landmark: "雨巷信箱亭",
    summary: "会把一句普通寒暄轻轻说成谜语，是所有暗线的发明者。",
    mood: "好奇又带点神秘",
    travelStyle: "慢慢逛，把可疑细节都记下来",
    actionIdea: "想问问旧街最近有没有奇怪的征兆，也试着听懂它在暗示什么。",
    x: 55,
    y: 73,
    body: "#8e3b52",
    accent: "#ffd7e2"
  },
  {
    id: "archivist-cat",
    alias: "档案猫",
    role: "手账管理员",
    zoneId: "archive-house",
    landmark: "故事归档台",
    summary: "会把当下的对话立刻装订成一页手账，还会顺手提醒下一段去哪里。",
    mood: "温柔而专注",
    travelStyle: "边经历边整理纪念物",
    actionIdea: "想把今天见到的线索整理进手账，也问问它最珍贵的收藏是哪一页。",
    x: 84,
    y: 51,
    body: "#6f593e",
    accent: "#ffe08b"
  }
];

// AI auto-explore actually walks to a cat and improvises a brand-new encounter,
// so its progress reads as an exploration pipeline.
const autoPhases = [
  {
    id: "move",
    label: "Pathfinding",
    detail: "主角猫正在穿过地图前往目标地点"
  },
  {
    id: "kiosk",
    label: "Info Kiosk",
    detail: "信息台整理你的目标、语气和探索方式"
  },
  {
    id: "scout",
    label: "Scout Cat",
    detail: "生成新的场景与遭遇开场"
  },
  {
    id: "companion",
    label: "Companion Cat",
    detail: "组织对话，让目标猫先开口"
  },
  {
    id: "oracle",
    label: "Oracle Cat",
    detail: "悄悄压入暗线与伏笔"
  },
  {
    id: "archive",
    label: "Archivist Cat",
    detail: "把相遇写成故事并留存"
  }
] as const;

// Archiving a real chat has no walking or new encounter — it turns the
// conversation you already had into a story chapter, so the copy differs.
const archivePhases = [
  {
    id: "kiosk",
    label: "Info Kiosk",
    detail: "信息台整理这段对话的语气与线索"
  },
  {
    id: "scout",
    label: "Scout Cat",
    detail: "还原你们相遇时的场景与氛围"
  },
  {
    id: "companion",
    label: "Companion Cat",
    detail: "附近的猫补上几句幕后花絮"
  },
  {
    id: "oracle",
    label: "Oracle Cat",
    detail: "悄悄压入暗线与伏笔"
  },
  {
    id: "archive",
    label: "Archivist Cat",
    detail: "把这段对话写成一页手账"
  }
] as const;

// Image generation is the slow tail of a journey, so surface it as its own
// phase (only when a postcard will actually be drawn) instead of freezing on
// "Archivist Cat" while the picture renders.
const painterPhase = {
  id: "painter",
  label: "Painter Cat",
  detail: "画师猫正在画明信片配图，出图可能要等一会儿"
} as const;

type RequestPhase = { id: string; label: string; detail: string };

function getRequestPhases(
  mode: "manual_talk" | "auto_explore",
  drawsPostcard = false
): RequestPhase[] {
  const base = mode === "auto_explore" ? autoPhases : archivePhases;
  return drawsPostcard ? [...base, painterPhase] : [...base];
}

const defaultNpc = npcCats[0];

const initialForm = {
  catName: "石小猫",
  mood: defaultNpc.mood,
  travelStyle: defaultNpc.travelStyle,
  userAction: defaultNpc.actionIdea,
  generatePostcard: false
};

const PLAYER_FUR = "#b9c3cb";
const PLAYER_STRIPE = "#5c6870";
const PLAYER_ACCENT = "#ffe58d";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function wait(milliseconds: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function getNpcById(id: string) {
  return npcCats.find((npc) => npc.id === id) ?? defaultNpc;
}

function getZoneById(id: string) {
  return zones.find((zone) => zone.id === id) ?? zones[0];
}

function getMeetPoint(npc: NpcCat): MapPosition {
  return {
    x: clamp(npc.x - 4, 8, 92),
    y: clamp(npc.y + 10, 12, 88)
  };
}

function getDistance(a: MapPosition, b: MapPosition) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function findClosestZone(position: MapPosition) {
  return zones.reduce((closest, zone) => {
    const currentDistance = getDistance(position, { x: zone.x, y: zone.y });
    const bestDistance = getDistance(position, { x: closest.x, y: closest.y });
    return currentDistance < bestDistance ? zone : closest;
  }, zones[0]);
}

// Each cat lives alone at its own landmark, so "nearby" means physically close
// on the map rather than sharing a zone (same-zone siblings never exist, which
// would leave the list — and the story's banter source — permanently empty).
const NEARBY_RADIUS = 46;
const NEARBY_LIMIT = 3;

function getNearbyCats(target: NpcCat) {
  return npcCats
    .filter((cat) => cat.id !== target.id)
    .map((cat) => ({ cat, distance: getDistance(target, cat) }))
    .filter((entry) => entry.distance <= NEARBY_RADIUS)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, NEARBY_LIMIT)
    .map((entry) => entry.cat);
}

function formatDate(dateString: string) {
  // Pin the time zone so server (often UTC) and client render the identical
  // string; otherwise the SSR'd timestamp differs from the client and React
  // throws a hydration mismatch.
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(dateString));
}

function parseSpeakerLine(line: string) {
  const [speaker, ...rest] = line.split(/[:：]/);

  if (!rest.length) {
    return {
      speaker: "路过的猫",
      text: line
    };
  }

  return {
    speaker: speaker.trim(),
    text: rest.join("：").trim()
  };
}

function findRecordForDemo(records: JourneyRecord[], focusNpcId: string | null) {
  if (!records.length) {
    return null;
  }

  if (!focusNpcId) {
    return records[0];
  }

  const focusNpc = getNpcById(focusNpcId);

  return (
    records.find((record) => record.input.focusCatName === focusNpc.alias) ??
    records.find((record) => record.input.destination === getZoneById(focusNpc.zoneId).name) ??
    records[0]
  );
}

function MapBackdrop() {
  return (
    <svg
      aria-hidden="true"
      className="map-svg"
      viewBox="0 0 1200 760"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="sea" x1="0%" x2="100%" y1="0%" y2="100%">
          <stop offset="0%" stopColor="#90d7d7" />
          <stop offset="100%" stopColor="#4f93a8" />
        </linearGradient>
        <linearGradient id="land" x1="0%" x2="100%" y1="0%" y2="100%">
          <stop offset="0%" stopColor="#f6dc94" />
          <stop offset="100%" stopColor="#d6b06f" />
        </linearGradient>
      </defs>

      <rect fill="url(#sea)" height="760" rx="38" width="1200" />
      <path
        d="M86 640C212 458 382 438 498 406C646 365 742 243 861 191C960 147 1060 161 1128 196L1128 760L86 760Z"
        fill="url(#land)"
      />
      <path
        d="M92 582C202 526 300 490 429 470C556 448 671 395 792 292C872 224 960 191 1062 187"
        fill="none"
        opacity="0.62"
        stroke="#7d5e2d"
        strokeDasharray="20 16"
        strokeLinecap="round"
        strokeWidth="10"
      />
      <path
        d="M0 590C123 536 262 526 388 544C540 566 643 537 730 461C850 356 955 313 1200 345"
        fill="none"
        opacity="0.56"
        stroke="#fff3ca"
        strokeDasharray="12 14"
        strokeLinecap="round"
        strokeWidth="8"
      />
      <path
        d="M552 0C617 103 612 220 548 315C505 379 500 470 562 552C622 632 613 710 568 760"
        fill="none"
        opacity="0.34"
        stroke="#d8f3ff"
        strokeWidth="54"
      />
      <circle cx="215" cy="444" fill="#fff4cd" opacity="0.64" r="96" />
      <circle cx="934" cy="134" fill="#fff0b3" opacity="0.52" r="76" />
      <circle cx="680" cy="644" fill="#ffd7dd" opacity="0.24" r="44" />
      <g fill="#3c644b" opacity="0.82">
        <path d="M880 220L906 136L932 220Z" />
        <rect height="82" rx="6" width="14" x="899" y="220" />
        <path d="M334 292L366 228L398 292Z" />
        <rect height="72" rx="6" width="14" x="359" y="292" />
        <path d="M742 480L772 414L804 480Z" />
        <rect height="68" rx="6" width="14" x="766" y="480" />
      </g>
      <g fill="#fffaf2" opacity="0.92" stroke="#835f36" strokeWidth="4">
        <circle cx="220" cy="500" r="16" />
        <circle cx="404" cy="228" r="16" />
        <circle cx="650" cy="542" r="16" />
        <circle cx="860" cy="170" r="16" />
        <circle cx="1000" cy="382" r="16" />
      </g>
    </svg>
  );
}

function CatSprite({
  accent,
  body,
  highlight = false,
  moving = false,
  tabby = false,
  stripe
}: {
  accent: string;
  body: string;
  highlight?: boolean;
  moving?: boolean;
  /** Overlay silver-tabby markings (forehead "M", back stripes, pink nose). */
  tabby?: boolean;
  stripe?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      className={`svg-cat ${highlight ? "is-highlight" : ""} ${moving ? "is-moving" : ""}`}
      viewBox="0 0 120 132"
    >
      <path
        className="cat-tail"
        d="M22 90C4 78 8 44 28 49C37 51 39 63 34 70C28 77 27 83 40 88"
        fill="none"
        stroke={body}
        strokeLinecap="round"
        strokeWidth="12"
      />
      <ellipse cx="62" cy="92" fill={body} rx="30" ry="27" />
      <path d="M40 30L53 14L58 36Z" fill={body} />
      <path d="M64 36L70 14L84 30Z" fill={body} />
      <circle cx="62" cy="46" fill={body} r="28" />
      {tabby ? (
        <g
          fill="none"
          opacity="0.8"
          stroke={stripe ?? "#5c6870"}
          strokeLinecap="round"
          strokeWidth="3"
        >
          <path d="M54 33L56 22" />
          <path d="M62 34L62 21" />
          <path d="M70 33L68 22" />
          <path d="M40 30L48 34" />
          <path d="M84 30L76 34" />
          <path d="M40 98C50 92 74 92 84 98" />
          <path d="M42 108C52 103 72 103 82 108" />
        </g>
      ) : null}
      <ellipse cx="62" cy="57" fill="#fef8f0" rx="16" ry="12" />
      <circle cx="52" cy="46" fill="#182221" r="4" />
      <circle cx="72" cy="46" fill="#182221" r="4" />
      {tabby ? <path d="M59 51L65 51L62 55Z" fill="#d98a86" /> : null}
      <path
        d="M58 56C60 58 64 58 66 56"
        fill="none"
        stroke="#182221"
        strokeLinecap="round"
        strokeWidth="3"
      />
      <path
        d="M38 70C52 82 76 82 88 70"
        fill="none"
        opacity="0.9"
        stroke={accent}
        strokeLinecap="round"
        strokeWidth="12"
      />
      <circle cx="88" cy="70" fill={accent} r="7" />
      <path
        d="M46 59H18M46 64H20M78 59H106M78 64H104"
        fill="none"
        opacity="0.65"
        stroke="#684a2b"
        strokeLinecap="round"
        strokeWidth="2.5"
      />
    </svg>
  );
}

function PostcardCard({ url, title }: { url: string; title?: string }) {
  const [failed, setFailed] = useState(false);

  return (
    <figure className="postcard-card">
      {failed ? (
        <div className="postcard-fallback">
          <span>明信片图片加载失败</span>
          <p>配图链接可能已过期（生成后约 24 小时有效）。</p>
        </div>
      ) : (
        // Remote provider host isn't allow-listed for next/image, and the URL
        // is a short-lived signed link, so a plain <img> with a fallback fits best.
        // eslint-disable-next-line @next/next/no-img-element
        <img alt={title ? `明信片：${title}` : "画师猫的明信片"} onError={() => setFailed(true)} src={url} />
      )}
      {title ? <figcaption>✦ 画师猫的明信片 · {title}</figcaption> : null}
    </figure>
  );
}

export function TravelNekoApp({
  initialRecords,
  config
}: TravelNekoAppProps) {
  const [view, setView] = useState<GameView>("title");
  const [records, setRecords] = useState(initialRecords);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialRecords[0]?.id ?? null
  );
  const [selectedNpcId, setSelectedNpcId] = useState(defaultNpc.id);
  const [playerPosition, setPlayerPosition] = useState<MapPosition>({ x: 48, y: 84 });
  const [form, setForm] = useState(initialForm);
  const [requestStage, setRequestStage] = useState(-1);
  const [statusFeed, setStatusFeed] = useState<string[]>([
    "欢迎来到旅行猫。先点击“开始旅行”，再选择要靠近的猫咪。"
  ]);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isWalking, setIsWalking] = useState(false);
  const [isAutoExploring, setIsAutoExploring] = useState(false);
  const [runDrawsPostcard, setRunDrawsPostcard] = useState(false);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [showCustomize, setShowCustomize] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [archiveNudge, setArchiveNudge] = useState(false);
  const walkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stageTickerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const didApplyQueryDemoRef = useRef(false);

  useEffect(() => {
    if (!records.length) {
      setSelectedId(null);
      return;
    }

    if (!selectedId || !records.some((record) => record.id === selectedId)) {
      setSelectedId(records[0].id);
    }
  }, [records, selectedId]);

  useEffect(() => {
    if (typeof window === "undefined" || didApplyQueryDemoRef.current) {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const wantsWorld = params.get("view") === "world";
    const focusId = params.get("focus");
    const demo = params.get("demo") as DemoMode | null;

    if (!wantsWorld && !demo && !focusId) {
      didApplyQueryDemoRef.current = true;
      return;
    }

    const focusNpc = focusId ? getNpcById(focusId) : defaultNpc;
    const matchedRecord = findRecordForDemo(records, focusId);

    if (wantsWorld) {
      setView("world");
    }

    if (focusId) {
      setSelectedNpcId(focusNpc.id);
      hydrateFormFromNpc(focusNpc);
      setPlayerPosition(getMeetPoint(focusNpc));
    }

    if (matchedRecord) {
      setSelectedId(matchedRecord.id);
    }

    if (demo === "explore") {
      setPlayerPosition({
        x: clamp(focusNpc.x - 10, 8, 92),
        y: clamp(focusNpc.y + 14, 10, 90)
      });
      setRequestStage(-1);
      setStatusFeed([
        `主角猫正在 ${getZoneById(focusNpc.zoneId).name} 自由探索。`,
        `${focusNpc.alias} 已进入视野，可以主动靠近发起对话。`
      ]);
    }

    if (demo === "dialogue") {
      setPlayerPosition(getMeetPoint(focusNpc));
      setStatusFeed([
        `你已经靠近 ${focusNpc.alias}，附近猫咪正在准备插话。`,
        "对话完成后，这一段相遇会被直接写进手账。"
      ]);
    }

    if (demo === "archive") {
      setPlayerPosition(getMeetPoint(focusNpc));
      setStatusFeed([
        "本次相遇已经归档完成。",
        "手账、对话、Agent 注释都已写入故事记录。"
      ]);
    }

    if (demo === "auto-kiosk") {
      setRequestStage(3);
      setIsAutoExploring(true);
      setStatusFeed([
        `AI 正在 ${getZoneById(focusNpc.zoneId).name} 自主探索，并准备和 ${focusNpc.alias} 相遇。`,
        "信息台已切到自动模式，其他猫咪也可能加入插话。",
        "Scout Cat 已经布置好开场，Companion Cat 正在组织对话。"
      ]);
    }

    didApplyQueryDemoRef.current = true;
  }, [records]);

  useEffect(() => {
    return () => {
      if (walkTimerRef.current) {
        clearTimeout(walkTimerRef.current);
      }

      if (stageTickerRef.current) {
        clearInterval(stageTickerRef.current);
      }
    };
  }, []);

  const activeNpc = getNpcById(selectedNpcId);
  const activeZone = getZoneById(activeNpc.zoneId);
  const currentZone = findClosestZone(playerPosition);
  const activeRecord =
    records.find((record) => record.id === selectedId) ?? records[0] ?? null;
  const activeRecordFocusName = activeRecord?.input.focusCatName || activeNpc.alias;
  const nearbyCats = getNearbyCats(activeNpc);
  const talkDistance =
    getDistance(playerPosition, getMeetPoint(activeNpc)) <= 8 ||
    getDistance(playerPosition, { x: activeNpc.x, y: activeNpc.y }) <= 12;
  const activePhases = getRequestPhases(
    isAutoExploring ? "auto_explore" : "manual_talk",
    runDrawsPostcard
  );
  const currentPhase =
    requestStage >= 0
      ? activePhases[Math.min(requestStage, activePhases.length - 1)]
      : null;
  const latestStatus = statusFeed[0] ?? null;

  function updateField<Key extends keyof typeof initialForm>(
    key: Key,
    value: (typeof initialForm)[Key]
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function pushStatus(note: string) {
    setStatusFeed((current) => [note, ...current].slice(0, 7));
  }

  function handleTravelImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      setImageDataUrl(null);
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError("请选择一张图片文件。");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        return;
      }
      if (result.length > MAX_IMAGE_DATA_URL_CHARS) {
        setError("图片太大，请选择较小的文件。");
        setImageDataUrl(null);
        return;
      }
      setError("");
      setImageDataUrl(result);
    };
    reader.readAsDataURL(file);
  }

  function clearWalkTimer() {
    if (walkTimerRef.current) {
      clearTimeout(walkTimerRef.current);
      walkTimerRef.current = null;
    }
  }

  function clearStageTicker() {
    if (stageTickerRef.current) {
      clearInterval(stageTickerRef.current);
      stageTickerRef.current = null;
    }
  }

  function beginWalk(nextPosition: MapPosition, note?: string) {
    clearWalkTimer();
    setIsWalking(true);
    setPlayerPosition({
      x: clamp(nextPosition.x, 7, 93),
      y: clamp(nextPosition.y, 10, 90)
    });

    if (note) {
      pushStatus(note);
    }

    walkTimerRef.current = setTimeout(() => {
      setIsWalking(false);
      walkTimerRef.current = null;
    }, WALK_DURATION_MS);
  }

  const movePlayerBy = useCallback((deltaX: number, deltaY: number) => {
    if (walkTimerRef.current) {
      clearTimeout(walkTimerRef.current);
      walkTimerRef.current = null;
    }
    setIsWalking(true);
    setPlayerPosition((current) => ({
      x: clamp(current.x + deltaX, 7, 93),
      y: clamp(current.y + deltaY, 10, 90)
    }));

    walkTimerRef.current = setTimeout(() => {
      setIsWalking(false);
      walkTimerRef.current = null;
    }, 180);
  }, []);

  useEffect(() => {
    if (view !== "world") {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target;

      if (
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA")
      ) {
        return;
      }

      if (isSubmitting) {
        return;
      }

      let nextOffset: MapPosition | null = null;

      switch (event.key) {
        case "ArrowUp":
        case "w":
        case "W":
          nextOffset = { x: 0, y: -4 };
          break;
        case "ArrowDown":
        case "s":
        case "S":
          nextOffset = { x: 0, y: 4 };
          break;
        case "ArrowLeft":
        case "a":
        case "A":
          nextOffset = { x: -4, y: 0 };
          break;
        case "ArrowRight":
        case "d":
        case "D":
          nextOffset = { x: 4, y: 0 };
          break;
        default:
          break;
      }

      if (!nextOffset) {
        return;
      }

      event.preventDefault();
      movePlayerBy(nextOffset.x, nextOffset.y);
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isSubmitting, view, movePlayerBy]);

  // Walking up to a cat makes it the conversation target automatically. We only
  // retarget before a conversation starts, so wandering mid-chat never discards
  // an ongoing exchange (and auto-explore drives the target on its own).
  useEffect(() => {
    if (view !== "world" || isSubmitting || isAutoExploring || chatMessages.length > 0) {
      return;
    }

    const nearest = npcCats.reduce(
      (best, cat) => {
        const distance = getDistance(playerPosition, { x: cat.x, y: cat.y });
        return distance < best.distance ? { cat, distance } : best;
      },
      { cat: npcCats[0], distance: Infinity }
    ).cat;

    if (nearest.id !== selectedNpcId) {
      setSelectedNpcId(nearest.id);
    }
  }, [playerPosition, view, isSubmitting, isAutoExploring, chatMessages.length, selectedNpcId]);

  function hydrateFormFromNpc(npc: NpcCat) {
    setForm((current) => ({
      ...current,
      mood: npc.mood,
      travelStyle: npc.travelStyle,
      userAction: npc.actionIdea
    }));
  }

  function focusNpc(
    npc: NpcCat,
    options: {
      annotate?: boolean;
      hydrate?: boolean;
      walk?: boolean;
    } = {}
  ) {
    if (isSubmitting) {
      return;
    }

    setSelectedNpcId(npc.id);

    if (options.hydrate !== false) {
      hydrateFormFromNpc(npc);
    }

    if (options.walk !== false) {
      beginWalk(
        getMeetPoint(npc),
        options.annotate === false ? undefined : `${form.catName} 朝 ${npc.alias} 的位置靠近。`
      );
    }
  }

  function moveToZone(zone: Zone) {
    if (isSubmitting) {
      return;
    }

    const representative = npcCats.find((npc) => npc.zoneId === zone.id) ?? defaultNpc;
    setSelectedNpcId(representative.id);
    beginWalk(
      {
        x: zone.x,
        y: clamp(zone.y + 8, 10, 90)
      },
      `${form.catName} 沿着小路朝 ${zone.name} 走去。`
    );
  }

  function startRequestTicker(
    npc: NpcCat,
    mode: "manual_talk" | "auto_explore",
    areaName: string,
    ticker: { catName: string; drawsPostcard: boolean }
  ) {
    clearStageTicker();

    const phases = getRequestPhases(mode, ticker.drawsPostcard);
    const baseNotes =
      mode === "auto_explore"
        ? [
            `${ticker.catName} 正朝 ${npc.landmark} 接近。`,
            `信息台已切换为 AI 探索模式，将在 ${areaName} 自主寻找新相遇。`,
            `Scout Cat 正在为 ${areaName} 布置遭遇场景。`,
            `${npc.alias} 正准备先开口，附近的猫也可能插话。`,
            "Oracle Cat 正在把隐藏线索压进这一段对话。",
            "Archivist Cat 正在装订新的手账页。"
          ]
        : [
            `信息台正在整理你和 ${npc.alias} 的这段对话。`,
            `Scout Cat 正在还原你们相遇时的场景。`,
            "附近的猫正在补上几句幕后花絮。",
            "Oracle Cat 正在把隐藏线索压进这段故事。",
            "Archivist Cat 正在把这段对话写成一页手账。"
          ];
    const phaseNotes = ticker.drawsPostcard
      ? [...baseNotes, "画师猫正在画明信片配图，出图可能要等一会儿…"]
      : baseNotes;

    setRequestStage(0);
    pushStatus(phaseNotes[0]);

    let stageIndex = 0;
    stageTickerRef.current = setInterval(() => {
      stageIndex = Math.min(stageIndex + 1, phases.length - 1);
      setRequestStage(stageIndex);
      pushStatus(phaseNotes[stageIndex]);

      if (stageIndex === phases.length - 1) {
        clearStageTicker();
      }
    }, 1100);
  }

  async function executeJourney(options: {
    npc: NpcCat;
    mode: "manual_talk" | "auto_explore";
    actionText: string;
    hydrateBeforeWalk?: boolean;
    /** Real chat transcript to archive into a story chapter. */
    conversation?: string;
    /** Avoid stale form in status ticker after setState (e.g. auto explore). */
    ticker?: { catName: string };
  }) {
    const npc = options.npc;
    const zone = getZoneById(npc.zoneId);
    const sideCats = getNearbyCats(npc);

    const catName = options.ticker?.catName ?? form.catName;
    // A postcard image only renders when both the feature is enabled and the
    // player asked for one; that's the slow step worth surfacing as a phase.
    const drawsPostcard = config.imageGenerationEnabled && form.generatePostcard;

    if (options.hydrateBeforeWalk === true) {
      hydrateFormFromNpc(npc);
    }

    setSelectedNpcId(npc.id);
    setError("");
    setIsSubmitting(true);
    setIsAutoExploring(options.mode === "auto_explore");
    setRunDrawsPostcard(drawsPostcard);
    startRequestTicker(npc, options.mode, zone.name, { catName, drawsPostcard });

    if (!talkDistance || options.mode === "auto_explore") {
      beginWalk(
        getMeetPoint(npc),
        options.mode === "auto_explore"
          ? `AI 正带着 ${catName} 前往 ${zone.name} 的 ${npc.landmark}。`
          : `${catName} 正走向 ${npc.alias}。`
      );
      await wait(WALK_DURATION_MS + 120);
    }

    try {
      const payload: Record<string, unknown> = {
        catName: form.catName,
        destination: zone.name,
        currentArea: zone.name,
        zoneId: zone.id,
        mood: options.mode === "auto_explore" ? npc.mood : form.mood,
        travelStyle:
          options.mode === "auto_explore" ? npc.travelStyle : form.travelStyle,
        userAction: options.actionText,
        focusCatName: npc.alias,
        focusCatRole: npc.role,
        focusNpcId: npc.id,
        nearbyCats: sideCats.map((cat) => `${cat.alias}(${cat.role})`),
        encounterMode: options.mode,
        generatePostcard: form.generatePostcard
      };

      if (imageDataUrl) {
        payload.imageDataUrl = imageDataUrl;
      }

      if (options.conversation) {
        payload.conversation = options.conversation;
      }

      const response = await fetch("/api/journey", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const json = (await response.json()) as JourneyResponse | { error: string };
      if (!response.ok || "error" in json) {
        throw new Error("error" in json ? json.error : "Failed to run the journey.");
      }

      clearStageTicker();
      setRequestStage(getRequestPhases(options.mode, drawsPostcard).length - 1);
      setRecords((current) =>
        [json.record, ...current.filter((record) => record.id !== json.record.id)].slice(0, 20)
      );
      setSelectedId(json.record.id);
      setImageDataUrl(null);
      pushStatus(`《${json.record.archive.chapterTitle}》已写入手账。`);
    } catch (submitError) {
      clearStageTicker();
      setRequestStage(-1);
      setError(
        submitError instanceof Error
          ? submitError.message
          : "TravelNeko ran into an unexpected issue."
      );
      pushStatus("信息台提示：这次探索失败了，可以再试一次。");
    } finally {
      setIsSubmitting(false);
      setIsAutoExploring(false);
    }
  }

  // The stage <form> only wraps inputs; archiving is driven by explicit buttons,
  // so swallow accidental Enter submits instead of running a journey.
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }

  const handleChatMessages = useCallback((messages: ChatMessage[]) => {
    setChatMessages(messages);
    // A plot beat just fired — that's a natural chapter boundary worth saving.
    if (messages[messages.length - 1]?.triggeredPlot) {
      setArchiveNudge(true);
    } else if (messages.length === 0) {
      // Conversation reset (switched NPC): drop any stale suggestion.
      setArchiveNudge(false);
    }
  }, []);

  async function handleArchiveChat() {
    if (isSubmitting) {
      return;
    }
    if (!chatMessages.length) {
      setError("先和这只猫聊几句，再把这段相遇写进手账。");
      return;
    }

    setArchiveNudge(false);

    const transcript = chatMessages
      .map((message) => `${message.speaker}：${message.text}`)
      .join("\n");

    await executeJourney({
      npc: activeNpc,
      mode: "manual_talk",
      actionText: `把 ${form.catName} 和 ${activeNpc.alias}（${activeNpc.role}）的这段对话整理成一章旅行故事。`,
      conversation: transcript,
      hydrateBeforeWalk: false
    });
  }

  async function handleAutoExplore() {
    if (isSubmitting) {
      return;
    }

    const candidatePool = npcCats.filter((npc) => npc.id !== activeNpc.id);
    const nextNpc =
      candidatePool[Math.floor(Math.random() * candidatePool.length)] ?? defaultNpc;
    const zone = getZoneById(nextNpc.zoneId);
    const catName = form.catName;
    const nextUserAction = `让旅程自己流动，看看 ${zone.name} 会发生什么，也欢迎路过的猫偶尔插话。`;

    setSelectedNpcId(nextNpc.id);
    setForm((current) => ({
      ...current,
      mood: nextNpc.mood,
      travelStyle: nextNpc.travelStyle,
      userAction: nextUserAction
    }));

    await executeJourney({
      npc: nextNpc,
      mode: "auto_explore",
      actionText: `让旅程自己流动，沿着 ${zone.subtitle} 自由探索，看看 ${nextNpc.alias} 会先说什么，也欢迎其他猫咪偶尔插话。`,
      hydrateBeforeWalk: false,
      ticker: { catName }
    });
  }

  function handleMapClick(event: ReactMouseEvent<HTMLDivElement>) {
    if (isSubmitting) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const position = {
      x: ((event.clientX - rect.left) / rect.width) * 100,
      y: ((event.clientY - rect.top) / rect.height) * 100
    };
    const zone = findClosestZone(position);
    beginWalk(position, `${form.catName} 走到了 ${zone.name} 一带。`);
  }

  function jumpFromTitle() {
    setView("world");
    pushStatus("已进入地图。可以手动移动，也可以点猫或点区域自动寻路。");
  }

  function syncFromRecord(record: JourneyRecord) {
    setSelectedId(record.id);

    const relatedNpc =
      npcCats.find((npc) => npc.alias === record.input.focusCatName) ??
      npcCats.find((npc) => getZoneById(npc.zoneId).name === record.input.destination) ??
      defaultNpc;

    setSelectedNpcId(relatedNpc.id);
    setPlayerPosition(getMeetPoint(relatedNpc));
  }

  async function handleResetHistory() {
    if (isSubmitting || isResetting || !records.length) {
      return;
    }

    const confirmed = window.confirm(
      "确定要重置吗？手账故事、剧情进度和聊天记录都会被永久清空，之前触发过的剧情也会重新变得可触发。此操作不可恢复。"
    );

    if (!confirmed) {
      return;
    }

    setError("");
    setIsResetting(true);

    try {
      const response = await fetch("/api/journals", { method: "DELETE" });

      if (!response.ok) {
        const json = (await response.json()) as { error?: string };
        throw new Error(json.error || "Failed to reset journal history.");
      }

      setRecords([]);
      setSelectedId(null);
      setRequestStage(-1);
      setStatusFeed([
        "已重置：手账、剧情进度与聊天记录都清空了，所有剧情又可以重新触发。"
      ]);
    } catch (resetError) {
      setError(
        resetError instanceof Error
          ? resetError.message
          : "TravelNeko ran into an unexpected issue."
      );
    } finally {
      setIsResetting(false);
    }
  }

  if (view === "title") {
    return (
      <main className="title-shell">
        <section className="title-grid">
          <article className="title-card">
            <p className="eyebrow">TravelNeko / Stardew-like Opening</p>
            <h1>从一块旅行地图开始，慢慢走进一座会说话的猫咪小镇。</h1>
            <p className="title-copy">
              进入游戏后，你可以手动移动主角猫，也可以点一下让 AI 自动探索。和某只猫多轮聊天，聊到对味
              可能触发一段剧情；把这段相遇写进手账时，旁边的猫也会来凑几句，凑成一段小故事。
            </p>

            <div className="title-points">
              <div>
                <strong>1. 先开始</strong>
                <span>像星露谷物语那样，先从一张有氛围的开始界面进入旅程。</span>
              </div>
              <div>
                <strong>2. 再探索</strong>
                <span>进入 RPG 风格地图后，可以自己走，也可以让 AI 替你决定下一站。</span>
              </div>
              <div>
                <strong>3. 然后聊天</strong>
                <span>和目标猫一对一多轮聊天，聊出剧情后写进手账；归档时旁边的猫也会来凑几句热闹。</span>
              </div>
            </div>

            <div className="title-actions">
              <button className="primary-button" onClick={jumpFromTitle} type="button">
                开始旅行
              </button>
              {records.length ? (
                <button
                  className="ghost-button"
                  onClick={() => {
                    jumpFromTitle();
                    syncFromRecord(records[0]);
                  }}
                  type="button"
                >
                  继续上次存档
                </button>
              ) : null}
              {records.length ? (
                <button
                  className="ghost-button danger"
                  disabled={isResetting}
                  onClick={handleResetHistory}
                  type="button"
                >
                  {isResetting ? "正在清空..." : "重置手账"}
                </button>
              ) : null}
            </div>

            <div className="title-models">
              <span>模型：{config.model}</span>
              <span>玩法：多轮聊天 + 剧情触发 + AI 自动探索</span>
            </div>
          </article>

          <article className="title-preview">
            <div className="preview-map">
              <MapBackdrop />
              {npcCats.map((npc) => (
                <div
                  className="preview-cat"
                  key={npc.id}
                  style={{ left: `${npc.x}%`, top: `${npc.y}%` }}
                >
                  <CatSprite accent={npc.accent} body={npc.body} />
                </div>
              ))}
              <div className="preview-player" style={{ left: "50%", top: "82%" }}>
                <CatSprite
                  accent={PLAYER_ACCENT}
                  body={PLAYER_FUR}
                  stripe={PLAYER_STRIPE}
                  tabby
                />
              </div>
            </div>

            <div className="preview-notes">
              <p className="eyebrow">Starter Town</p>
              <h2>雾灯港、彩旗集市、风车坡、月影旧街、纸灯书屋</h2>
              <p>
                点击进入后，你会落在地图中央，能直接用 `WASD` / 方向键走动，也能点地图或点猫自动过去。
              </p>
            </div>
          </article>
        </section>
      </main>
    );
  }

  return (
    <main className="page-shell world-shell">
      <header className="world-bar">
        <button className="ghost-button small" onClick={() => setView("title")} type="button">
          ← 返回
        </button>
        <div className="world-bar-status">
          <span className="status-pill">📍 {currentZone.name}</span>
          <span className="status-pill">🐾 {activeNpc.alias}</span>
          {talkDistance ? <span className="status-pill is-ready">可对话</span> : null}
        </div>
      </header>

      <form className="world-stage" onSubmit={handleSubmit}>
        <article className="paper-card map-panel">
            <div className="map-stage" onClick={handleMapClick}>
              <MapBackdrop />

              {zones.map((zone) => (
                <button
                  className={`zone-button ${zone.id === currentZone.id ? "is-current" : ""}`}
                  key={zone.id}
                  onClick={(event) => {
                    event.stopPropagation();
                    moveToZone(zone);
                  }}
                  style={{ left: `${zone.x}%`, top: `${zone.y}%`, borderColor: zone.accent }}
                  type="button"
                >
                  <strong>{zone.name}</strong>
                  <span>{zone.subtitle}</span>
                </button>
              ))}

              {npcCats.map((npc) => (
                <button
                  className={`map-cat ${npc.id === activeNpc.id ? "is-active" : ""}`}
                  key={npc.id}
                  onClick={(event) => {
                    event.stopPropagation();
                    focusNpc(npc);
                  }}
                  style={{ left: `${npc.x}%`, top: `${npc.y}%` }}
                  type="button"
                >
                  <div className="cat-shell">
                    <CatSprite
                      accent={npc.accent}
                      body={npc.body}
                      highlight={npc.id === activeNpc.id}
                    />
                    <span className="cat-label">{npc.alias}</span>
                    <span className="cat-subtitle">{npc.landmark}</span>
                  </div>
                </button>
              ))}

              <div
                className={`player-marker ${isWalking ? "is-traveling" : ""}`}
                style={{ left: `${playerPosition.x}%`, top: `${playerPosition.y}%` }}
              >
                <div className="cat-shell">
                  <CatSprite
                    accent={PLAYER_ACCENT}
                    body={PLAYER_FUR}
                    highlight
                    moving={isWalking}
                    stripe={PLAYER_STRIPE}
                    tabby
                  />
                  <span className="player-label">{form.catName}</span>
                  <span className="cat-subtitle">主角猫</span>
                </div>
              </div>

            </div>

            <div className="control-pad-wrap">
              <div className="control-copy">
                <strong>怎么移动</strong>
                <p>用 `WASD` / 方向键走动，也可以直接点地图空地或某只猫自动前往。</p>
              </div>
              <div className="control-pad">
                <button className="control-key" onClick={() => movePlayerBy(0, -4)} type="button">
                  ↑
                </button>
                <div className="control-row">
                  <button className="control-key" onClick={() => movePlayerBy(-4, 0)} type="button">
                    ←
                  </button>
                  <button className="control-key" onClick={() => movePlayerBy(4, 0)} type="button">
                    →
                  </button>
                </div>
                <button className="control-key" onClick={() => movePlayerBy(0, 4)} type="button">
                  ↓
                </button>
              </div>
            </div>

            <div className="action-dock">
              <div className="dock-target">
                <CatSprite accent={activeNpc.accent} body={activeNpc.body} highlight />
                <div className="dock-copy">
                  <h3>{activeNpc.alias}</h3>
                  <p className="dock-role">
                    {activeNpc.role} · {activeNpc.landmark}
                  </p>
                  <p className="dock-summary">{activeNpc.summary}</p>
                </div>
              </div>

              <div className="dock-actions">
                {archiveNudge && !isSubmitting ? (
                  <p className="archive-nudge">刚发生了值得记下的事，把它写进手账吧 →</p>
                ) : null}
                <button
                  className={`primary-button${
                    archiveNudge && !isSubmitting ? " is-suggested" : ""
                  }`}
                  disabled={isSubmitting || chatMessages.length === 0}
                  onClick={handleArchiveChat}
                  type="button"
                >
                  {isSubmitting && !isAutoExploring
                    ? "正在写进手账..."
                    : chatMessages.length === 0
                    ? "先聊几句，再写进手账"
                    : "把这段相遇写进手账"}
                </button>
                <button
                  className="ghost-button wide"
                  disabled={isSubmitting}
                  onClick={handleAutoExplore}
                  type="button"
                >
                  {isSubmitting && isAutoExploring ? "AI 正在探索..." : "让 AI 自动探索"}
                </button>
                <label
                  className={`checkbox-row dock-checkbox${
                    config.imageGenerationEnabled ? "" : " is-disabled"
                  }`}
                >
                  <input
                    checked={config.imageGenerationEnabled && form.generatePostcard}
                    disabled={!config.imageGenerationEnabled}
                    onChange={(event) => updateField("generatePostcard", event.target.checked)}
                    type="checkbox"
                  />
                  {config.imageGenerationEnabled
                    ? "归档时顺手让画师猫画一张明信片"
                    : "明信片配图已关闭"}
                </label>
                <button
                  aria-expanded={showCustomize}
                  className="text-button"
                  onClick={() => setShowCustomize((value) => !value)}
                  type="button"
                >
                  自定义这次相遇 {showCustomize ? "▲" : "▾"}
                </button>
              </div>
            </div>

            <div className="nearby-strip dock-nearby">
              <span>附近的猫 · 写进手账或自动探索时可能来凑几句</span>
              <div className="chip-row">
                {nearbyCats.length ? (
                  nearbyCats.map((cat) => (
                    <span className="route-chip" key={cat.id}>
                      {cat.alias}
                    </span>
                  ))
                ) : (
                  <span className="route-chip">这附近暂时只有它一只猫</span>
                )}
              </div>
            </div>

            {showCustomize ? (
              <div className="customize-panel">
                <div className="field-grid">
                  <label>
                    主角猫名字
                    <input
                      onChange={(event) => updateField("catName", event.target.value)}
                      value={form.catName}
                    />
                  </label>
                  <label>
                    当前情绪
                    <input
                      onChange={(event) => updateField("mood", event.target.value)}
                      value={form.mood}
                    />
                  </label>
                </div>

                <label>
                  行走风格
                  <input
                    onChange={(event) => updateField("travelStyle", event.target.value)}
                    value={form.travelStyle}
                  />
                </label>

                <label>
                  这次想怎么聊
                  <textarea
                    onChange={(event) => updateField("userAction", event.target.value)}
                    rows={4}
                    value={form.userAction}
                  />
                </label>

                <label className="file-upload-row">
                  可选旅行照片
                  <input accept="image/*" onChange={handleTravelImageChange} type="file" />
                  <span className="panel-tip">
                    带上一张旅途照片，猫咪们会从画面里读出氛围，写进这段故事里。
                  </span>
                  {imageDataUrl ? (
                    <button
                      className="ghost-button small"
                      onClick={() => {
                        setImageDataUrl(null);
                        setError("");
                      }}
                      type="button"
                    >
                      清除图片
                    </button>
                  ) : null}
                </label>

              </div>
            ) : null}

            {isSubmitting && currentPhase ? (
              <div className="run-progress">
                <span aria-hidden="true" className="run-spinner" />
                <div className="run-copy">
                  <strong>{currentPhase.label}</strong>
                  <p>{currentPhase.detail}</p>
                </div>
              </div>
            ) : latestStatus ? (
              <p className="run-hint">{latestStatus}</p>
            ) : null}

            {error ? <p className="error-text">{error}</p> : null}
          </article>

          <article className="paper-card chat-panel">
            <ChatWindow
              catName={form.catName}
              key={activeNpc.id}
              nearbyCats={nearbyCats.map((cat) => `${cat.alias}(${cat.role})`)}
              npcAlias={activeNpc.alias}
              npcId={activeNpc.id}
              npcRole={activeNpc.role}
              onMessagesChange={handleChatMessages}
              zoneId={activeZone.id}
              zoneName={activeZone.name}
            />
          </article>

          <article className="paper-card story-panel">
            {activeRecord ? (
              <>
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">最新相遇</p>
                    <h2>{activeRecord.archive.chapterTitle}</h2>
                  </div>
                  <span className="story-date">{formatDate(activeRecord.createdAt)}</span>
                </div>

                <p className="story-lede">{activeRecord.archive.summary}</p>

                {activeRecord.postcardImageUrl ? (
                  <PostcardCard
                    title={activeRecord.painter?.postcardTitle}
                    url={activeRecord.postcardImageUrl}
                  />
                ) : null}

                <details className="reveal">
                  <summary>展开这段相遇的对话与故事</summary>
                  <div className="reveal-body">
                    <div className="scene-strip">
                      <div>
                        <span>地图区域</span>
                        <strong>{activeRecord.input.destination}</strong>
                      </div>
                      <div>
                        <span>主要对话猫</span>
                        <strong>{activeRecord.input.focusCatName || activeNpc.alias}</strong>
                      </div>
                      <div>
                        <span>遭遇模式</span>
                        <strong>
                          {activeRecord.input.encounterMode === "auto_explore"
                            ? "AI 自动探索"
                            : "手动靠近对话"}
                        </strong>
                      </div>
                      <div>
                        <span>纪念物</span>
                        <strong>{activeRecord.archive.keepsake}</strong>
                      </div>
                      <div>
                        <span>触发剧情</span>
                        <strong>
                          {activeRecord.triggeredPlot
                            ? activeRecord.triggeredPlot.title
                            : "自由生成"}
                        </strong>
                      </div>
                    </div>

                    <div className="transcript-grid">
                      <section className="dialogue-card">
                        <p className="eyebrow">Conversation</p>
                        {activeRecord.input.conversation ? (
                          <>
                            <p className="dialogue-note">你和它的真实对话</p>
                            <div className="speech-stack">
                              {activeRecord.input.conversation
                                .split("\n")
                                .map((line) => line.trim())
                                .filter(Boolean)
                                .map((line, index) => {
                                  const parsed = parseSpeakerLine(line);
                                  const isPlayer = parsed.speaker.includes(
                                    activeRecord.input.catName
                                  );

                                  return (
                                    <div
                                      className={`speech ${isPlayer ? "is-player" : "is-focus"}`}
                                      key={`${index}-${line}`}
                                    >
                                      <strong>{parsed.speaker}</strong>
                                      <p>{parsed.text}</p>
                                    </div>
                                  );
                                })}
                            </div>
                          </>
                        ) : (
                          <>
                            <p className="dialogue-note">猫咪们事后转述的一幕</p>
                            <div className="speech-stack">
                              <div className="speech is-player">
                                <strong>{activeRecord.input.catName}</strong>
                                <p>{activeRecord.input.userAction}</p>
                              </div>
                              <div className="speech is-focus">
                                <strong>{activeRecord.input.focusCatName || "目标猫"}</strong>
                                <p>{activeRecord.companion.openingLine}</p>
                              </div>
                              {activeRecord.companion.banter.map((line, index) => {
                                const parsed = parseSpeakerLine(line);
                                const isFocus = parsed.speaker.includes(activeRecordFocusName);

                                return (
                                  <div
                                    className={`speech ${isFocus ? "is-focus" : "is-cameo"}`}
                                    key={`${index}-${line}`}
                                  >
                                    <strong>{parsed.speaker}</strong>
                                    <p>{parsed.text}</p>
                                  </div>
                                );
                              })}
                              <div className="speech is-invite">
                                <strong>下一步邀请</strong>
                                <p>{activeRecord.companion.invitation}</p>
                              </div>
                            </div>
                          </>
                        )}
                      </section>

                      <section className="story-card">
                        <p className="eyebrow">Storybook</p>
                        <h3>{activeRecord.archive.summary}</h3>
                        <p className="story-body">{activeRecord.archive.story}</p>
                      </section>
                    </div>

                    <div className="tag-row">
                      {activeRecord.archive.memoryTags.map((tag) => (
                        <span className="memory-tag" key={tag}>
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </details>

                <details className="reveal">
                  <summary>幕后花絮 · Agent 注释</summary>
                  <div className="agent-grid">
                    {activeRecord.agentNotes.map((note) => (
                      <section className="agent-card" key={note.agentId}>
                        <p className="agent-role">
                          {note.displayName} / {note.role}
                        </p>
                        <h3>{note.content}</h3>
                        <ul>
                          {note.highlights.map((highlight) => (
                            <li key={highlight}>{highlight}</li>
                          ))}
                        </ul>
                      </section>
                    ))}
                  </div>
                </details>
              </>
            ) : (
              <div className="empty-state">
                <p className="eyebrow">还没有故事</p>
                <h2>先在地图里走一走，找一只猫说话。</h2>
                <p>和某只猫聊几句再写进手账，或点「让 AI 自动探索」，第一段故事就会出现。</p>
              </div>
            )}
          </article>

        {records.length ? (
          <details className="paper-card journal-drawer">
            <summary className="journal-summary">
              <span className="journal-title">手账 · {records.length} 篇</span>
              <span className="journal-hint">展开查看全部故事</span>
            </summary>
            <div className="journal-body">
              <div className="timeline">
                {records.map((record) => (
                  <button
                    className={`timeline-entry ${record.id === activeRecord?.id ? "is-active" : ""}`}
                    key={record.id}
                    onClick={() => syncFromRecord(record)}
                    type="button"
                  >
                    <span>{formatDate(record.createdAt)}</span>
                    <strong>{record.archive.chapterTitle}</strong>
                    <p>{record.archive.summary}</p>
                  </button>
                ))}
              </div>
              <div className="journal-footer">
                <span>模型：{config.model}</span>
                <button
                  className="ghost-button small danger"
                  disabled={isResetting || isSubmitting}
                  onClick={handleResetHistory}
                  type="button"
                >
                  {isResetting ? "清空中..." : "重置手账"}
                </button>
              </div>
            </div>
          </details>
        ) : null}
      </form>
    </main>
  );
}
