import {
  createDefaultLevelOneProgress,
  normalizeLevelOneProgress,
  type LevelOneProgress,
} from "../game/progress";

export type SaveData = {
  version: 6;
  unlockedLevel: number;
  levelOne: LevelOneProgress;
};

export interface PlatformBridge {
  ready(): Promise<void>;
  gameplayStart(): void;
  gameplayStop(): void;
  load(): Promise<SaveData>;
  save(data: SaveData): Promise<void>;
}

const SAVE_KEY = "liminal-hunt-save-v6";
const LEGACY_V5_SAVE_KEY = "liminal-hunt-save-v5";
const LEGACY_V4_SAVE_KEY = "liminal-hunt-save-v4";
const LEGACY_V3_SAVE_KEY = "liminal-hunt-save-v3";
const LEGACY_V2_SAVE_KEY = "liminal-hunt-save-v2";
const LEGACY_V1_SAVE_KEY = "liminal-hunt-save-v1";

const initialSave: SaveData = {
  version: 6,
  unlockedLevel: 1,
  levelOne: createDefaultLevelOneProgress(),
};

class LocalPlatformBridge implements PlatformBridge {
  async ready(): Promise<void> {
    // Позже здесь будет LoadingAPI.ready() из SDK Яндекс Игр.
  }

  gameplayStart(): void {
    // Позже здесь будет GameplayAPI.start().
  }

  gameplayStop(): void {
    // Позже здесь будет GameplayAPI.stop().
  }

  async load(): Promise<SaveData> {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return this.migratePreviousSave();

    try {
      const parsed = JSON.parse(raw) as Partial<SaveData>;
      return {
        version: 6,
        unlockedLevel:
          typeof parsed.unlockedLevel === "number" && parsed.unlockedLevel >= 1
            ? Math.floor(parsed.unlockedLevel)
            : 1,
        levelOne: normalizeLevelOneProgress(parsed.levelOne),
      };
    } catch {
      return freshInitialSave();
    }
  }

  async save(data: SaveData): Promise<void> {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  }

  private migratePreviousSave(): SaveData {
    const versionFiveRaw = localStorage.getItem(LEGACY_V5_SAVE_KEY);
    if (versionFiveRaw) {
      try {
        const previous = JSON.parse(versionFiveRaw) as {
          unlockedLevel?: unknown;
          levelOne?: unknown;
        };
        const levelOne = normalizeLevelOneProgress(previous.levelOne);
        const migrated: SaveData = {
          version: 6,
          unlockedLevel:
            typeof previous.unlockedLevel === "number" && previous.unlockedLevel >= 1
              ? Math.floor(previous.unlockedLevel)
              : 1,
          levelOne: levelOne.completed
            ? { ...levelOne, zone: "boss-arena", completed: false }
            : levelOne,
        };
        localStorage.setItem(SAVE_KEY, JSON.stringify(migrated));
        return migrated;
      } catch {
        return freshInitialSave();
      }
    }

    const versionFourRaw = localStorage.getItem(LEGACY_V4_SAVE_KEY);
    if (versionFourRaw) {
      try {
        const previous = JSON.parse(versionFourRaw) as {
          unlockedLevel?: unknown;
          levelOne?: unknown;
        };
        const levelOne = normalizeLevelOneProgress(previous.levelOne);
        const migrated: SaveData = {
          version: 6,
          unlockedLevel:
            typeof previous.unlockedLevel === "number" && previous.unlockedLevel >= 1
              ? Math.floor(previous.unlockedLevel)
              : 1,
          levelOne: levelOne.completed
            ? { ...levelOne, zone: "observation-lab", completed: false }
            : levelOne,
        };
        localStorage.setItem(SAVE_KEY, JSON.stringify(migrated));
        return migrated;
      } catch {
        return freshInitialSave();
      }
    }

    const versionThreeRaw = localStorage.getItem(LEGACY_V3_SAVE_KEY);
    if (versionThreeRaw) {
      try {
        const previous = JSON.parse(versionThreeRaw) as {
          unlockedLevel?: unknown;
          levelOne?: unknown;
        };
        const levelOne = normalizeLevelOneProgress(previous.levelOne);
        const migrated: SaveData = {
          version: 6,
          unlockedLevel:
            typeof previous.unlockedLevel === "number" && previous.unlockedLevel >= 1
              ? Math.floor(previous.unlockedLevel)
              : 1,
          levelOne: levelOne.completed
            ? { ...levelOne, zone: "block-mines", completed: false }
            : levelOne,
        };
        localStorage.setItem(SAVE_KEY, JSON.stringify(migrated));
        return migrated;
      } catch {
        return freshInitialSave();
      }
    }

    const previousRaw = localStorage.getItem(LEGACY_V2_SAVE_KEY);
    if (previousRaw) {
      try {
        const previous = JSON.parse(previousRaw) as {
          unlockedLevel?: unknown;
          levelOne?: unknown;
        };
        const levelOne = normalizeLevelOneProgress(previous.levelOne);
        const migrated: SaveData = {
          version: 6,
          unlockedLevel:
            typeof previous.unlockedLevel === "number" && previous.unlockedLevel >= 1
              ? Math.floor(previous.unlockedLevel)
              : 1,
          levelOne: levelOne.completed
            ? { ...levelOne, zone: "pipe-dreams", completed: false }
            : levelOne,
        };
        localStorage.setItem(SAVE_KEY, JSON.stringify(migrated));
        return migrated;
      } catch {
        return freshInitialSave();
      }
    }

    const legacyRaw = localStorage.getItem(LEGACY_V1_SAVE_KEY);
    if (!legacyRaw) return freshInitialSave();

    try {
      const legacy = JSON.parse(legacyRaw) as { unlockedLevel?: unknown; notesFound?: unknown };
      const migrated: SaveData = {
        version: 6,
        unlockedLevel:
          typeof legacy.unlockedLevel === "number" && legacy.unlockedLevel >= 1
            ? Math.floor(legacy.unlockedLevel)
            : 1,
        levelOne: {
          ...createDefaultLevelOneProgress(),
          noteIds: Array.isArray(legacy.notesFound)
            ? legacy.notesFound.filter((id): id is string => typeof id === "string")
            : [],
        },
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(migrated));
      return migrated;
    } catch {
      return freshInitialSave();
    }
  }
}

export const platform: PlatformBridge = new LocalPlatformBridge();

function freshInitialSave(): SaveData {
  return {
    ...initialSave,
    levelOne: createDefaultLevelOneProgress(),
  };
}

