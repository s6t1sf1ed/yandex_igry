export const NOTE_01 = {
  id: "level-1-note-01",
  title: "Запись № 01",
  body: "Жёлтые комнаты повторяются, но служебная дверь настоящая. Ключ где-то рядом. За дверью слышны трубы и пар. Не верь улыбке: когда возьмёшь ключ, Верити начнёт искать тебя по шуму.",
} as const;

export const NOTE_01_ID = NOTE_01.id;
export const EXIT_KEY_ITEM_ID = "level-1-exit-key";
export const PIPE_VALVE_IDS = ["pipe-valve-01", "pipe-valve-02", "pipe-valve-03"] as const;
export const MINE_PICKAXE_ITEM_ID = "block-mine-pickaxe";
export const MINE_ANCHOR_IDS = ["mine-anchor-01", "mine-anchor-02", "mine-anchor-03"] as const;
export const NOTE_02 = {
  id: "level-2-note-01",
  title: "Шахтёрская памятка",
  body: "Кирку оставили в старом лагере. Ею можно разбить жёлтые наросты, которыми Верити удерживает проход. Не стой возле лавы и не иди за улыбкой.",
} as const;
export const NOTE_03 = {
  id: "level-2-note-02",
  title: "Последняя смена",
  body: "Мы разрушили два якоря, но третий вырос у нижнего штрека. После каждого удара шар становился быстрее. Портал наверху откроется только без всех трёх якорей.",
} as const;
export const NOTE_02_ID = NOTE_02.id;
export const NOTE_03_ID = NOTE_03.id;
export const LAB_TERMINAL_IDS = ["lab-terminal-01", "lab-terminal-02", "lab-terminal-03"] as const;
export const NOTE_04 = {
  id: "level-3-note-01",
  title: "Протокол наблюдения",
  body: "Объект V реагирует на включение контуров питания. Три терминала удерживают лифт закрытым, но каждый активный контур делает объект нестабильнее. После запуска третьего терминала немедленно уходите.",
} as const;
export const NOTE_04_ID = NOTE_04.id;
export const BOSS_WEAPON_ITEM_ID = "pulse-blaster";
export const BOSS_MAX_HEALTH = 8;
export type LevelOneZone =
  | "yellow-rooms"
  | "pipe-dreams"
  | "block-mines"
  | "observation-lab"
  | "boss-arena";

export type GameLevel = 1 | 2 | 3 | 4;

export type InventoryItemDefinition = {
  id: string;
  label: string;
};

export const INVENTORY_ITEMS: Readonly<Record<string, InventoryItemDefinition>> = {
  [EXIT_KEY_ITEM_ID]: {
    id: EXIT_KEY_ITEM_ID,
    label: "Ключ от выхода",
  },
  [MINE_PICKAXE_ITEM_ID]: {
    id: MINE_PICKAXE_ITEM_ID,
    label: "Железная кирка",
  },
  [BOSS_WEAPON_ITEM_ID]: {
    id: BOSS_WEAPON_ITEM_ID,
    label: "Импульсное ружьё",
  },
};

export type LevelOneProgress = {
  keyCollected: boolean;
  noteIds: string[];
  completed: boolean;
  flashlightCharge: number;
  batteryCollected: boolean;
  inventoryItemIds: string[];
  zone: LevelOneZone;
  activatedValveIds: string[];
  destroyedMineAnchorIds: string[];
  activatedLabTerminalIds: string[];
  bossHealth: number;
  livesRemaining: number;
};

export function createDefaultLevelOneProgress(): LevelOneProgress {
  return {
    keyCollected: false,
    noteIds: [],
    completed: false,
    flashlightCharge: 100,
    batteryCollected: false,
    inventoryItemIds: [],
    zone: "yellow-rooms",
    activatedValveIds: [],
    destroyedMineAnchorIds: [],
    activatedLabTerminalIds: [],
    bossHealth: BOSS_MAX_HEALTH,
    livesRemaining: 3,
  };
}

export function unlockedLevelForProgress(progress: LevelOneProgress): GameLevel {
  if (progress.completed || progress.zone === "boss-arena") return 4;
  if (progress.zone === "observation-lab") return 3;
  if (progress.zone === "block-mines") return 2;
  return 1;
}

export function createProgressForLevel(level: GameLevel): LevelOneProgress {
  const progress = createDefaultLevelOneProgress();
  if (level === 1) return progress;

  progress.keyCollected = true;
  progress.inventoryItemIds = [EXIT_KEY_ITEM_ID];
  progress.activatedValveIds = [...PIPE_VALVE_IDS];
  progress.zone = "block-mines";
  if (level === 2) return progress;

  progress.inventoryItemIds.push(MINE_PICKAXE_ITEM_ID);
  progress.destroyedMineAnchorIds = [...MINE_ANCHOR_IDS];
  progress.zone = "observation-lab";
  if (level === 3) return progress;

  progress.activatedLabTerminalIds = [...LAB_TERMINAL_IDS];
  progress.zone = "boss-arena";
  return progress;
}

export function normalizeLevelOneProgress(value: unknown): LevelOneProgress {
  const defaults = createDefaultLevelOneProgress();
  if (!value || typeof value !== "object") return defaults;

  const candidate = value as Partial<LevelOneProgress>;
  const inventoryItemIds = Array.isArray(candidate.inventoryItemIds)
    ? [...new Set(candidate.inventoryItemIds.filter((id): id is string => typeof id === "string"))]
    : [];
  if (candidate.keyCollected === true && !inventoryItemIds.includes(EXIT_KEY_ITEM_ID)) {
    inventoryItemIds.push(EXIT_KEY_ITEM_ID);
  }
  return {
    keyCollected: candidate.keyCollected === true,
    noteIds: Array.isArray(candidate.noteIds)
      ? [...new Set(candidate.noteIds.filter((id): id is string => typeof id === "string"))]
      : [],
    completed: candidate.completed === true,
    flashlightCharge:
      typeof candidate.flashlightCharge === "number" && Number.isFinite(candidate.flashlightCharge)
        ? Math.max(0, Math.min(100, candidate.flashlightCharge))
        : 100,
    batteryCollected: candidate.batteryCollected === true,
    inventoryItemIds,
    zone:
      candidate.zone === "pipe-dreams" ||
      candidate.zone === "block-mines" ||
      candidate.zone === "observation-lab" ||
      candidate.zone === "boss-arena"
        ? candidate.zone
        : "yellow-rooms",
    activatedValveIds: Array.isArray(candidate.activatedValveIds)
      ? [...new Set(candidate.activatedValveIds.filter((id): id is string => typeof id === "string"))]
      : [],
    destroyedMineAnchorIds: Array.isArray(candidate.destroyedMineAnchorIds)
      ? [...new Set(candidate.destroyedMineAnchorIds.filter((id): id is string => typeof id === "string"))]
      : [],
    activatedLabTerminalIds: Array.isArray(candidate.activatedLabTerminalIds)
      ? [...new Set(candidate.activatedLabTerminalIds.filter((id): id is string => typeof id === "string"))]
      : [],
    bossHealth:
      typeof candidate.bossHealth === "number" && Number.isFinite(candidate.bossHealth)
        ? Math.max(0, Math.min(BOSS_MAX_HEALTH, Math.floor(candidate.bossHealth)))
        : BOSS_MAX_HEALTH,
    livesRemaining:
      typeof candidate.livesRemaining === "number" && Number.isFinite(candidate.livesRemaining)
        ? Math.max(0, Math.min(3, Math.floor(candidate.livesRemaining)))
        : 3,
  };
}

