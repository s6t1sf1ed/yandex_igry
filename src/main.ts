import "./styles.css";
import { SoundManager } from "./audio/soundManager";
import {
  createPrototype,
  type PrototypeDebugState,
  type PrototypeGame,
} from "./game/createPrototype";
import {
  createProgressForLevel,
  INVENTORY_ITEMS,
  NOTE_01,
  NOTE_02,
  NOTE_03,
  NOTE_04,
  unlockedLevelForProgress,
  type GameLevel,
  type LevelOneProgress,
} from "./game/progress";
import { MobileControls } from "./input/mobileControls";
import { platform, type SaveData } from "./platform/platform";

const canvas = requiredElement<HTMLCanvasElement>("game-canvas");
const startScreen = requiredElement<HTMLElement>("start-screen");
const startButton = requiredElement<HTMLButtonElement>("start-button");
const objective = requiredElement<HTMLElement>("objective");
const status = requiredElement<HTMLElement>("status");
const flashlightChargeFill = requiredElement<HTMLElement>("flashlight-charge-fill");
const flashlightValue = requiredElement<HTMLElement>("flashlight-value");
const inventoryItems = requiredElement<HTMLElement>("inventory-items");
const livesValue = requiredElement<HTMLElement>("lives-value");
const bossHud = requiredElement<HTMLElement>("boss-hud");
const bossHealthFill = requiredElement<HTMLElement>("boss-health-fill");
const bossHealthValue = requiredElement<HTMLElement>("boss-health-value");
const interactionPrompt = requiredElement<HTMLElement>("interaction-prompt");
const quickActions = requiredElement<HTMLElement>("quick-actions");
const mobileControlsRoot = requiredElement<HTMLElement>("mobile-controls");
const controlsCopy = requiredElement<HTMLElement>("controls-copy");
const menuCurrentZone = requiredElement<HTMLElement>("menu-current-zone");
const menuUnlockedCount = requiredElement<HTMLElement>("menu-unlocked-count");
const levelCards = [...document.querySelectorAll<HTMLButtonElement>(".level-card")];
const zoneTransition = requiredElement<HTMLElement>("zone-transition");
const transitionKicker = requiredElement<HTMLElement>("transition-kicker");
const transitionTitle = requiredElement<HTMLElement>("transition-title");
const transitionSubtitle = requiredElement<HTMLElement>("transition-subtitle");
const noteScreen = requiredElement<HTMLElement>("note-screen");
const noteTitle = requiredElement<HTMLElement>("note-title");
const noteBody = requiredElement<HTMLElement>("note-body");
const noteCloseButton = requiredElement<HTMLButtonElement>("note-close-button");
const journalButton = requiredElement<HTMLButtonElement>("journal-button");
const journalScreen = requiredElement<HTMLElement>("journal-screen");
const journalProgress = requiredElement<HTMLElement>("journal-progress");
const journalNotes = requiredElement<HTMLElement>("journal-notes");
const journalCloseButton = requiredElement<HTMLButtonElement>("journal-close-button");
const soundToggleButton = requiredElement<HTMLButtonElement>("sound-toggle-button");
const caughtScreen = requiredElement<HTMLElement>("caught-screen");
const caughtMessage = requiredElement<HTMLElement>("caught-message");
const retryButton = requiredElement<HTMLButtonElement>("retry-button");

const sound = new SoundManager();
const previewParams = new URLSearchParams(window.location.search);
const touchPreviewRequested = previewParams.get("touch") === "1";
const autoStartPreview = touchPreviewRequested && previewParams.get("autostart") === "1";
const qaRequested = previewParams.get("qa") === "1";
const mobileMode =
  touchPreviewRequested ||
  (navigator.maxTouchPoints > 0 && window.matchMedia("(pointer: coarse)").matches);
let game: PrototypeGame | null = null;
let saveData: SaveData | null = null;
let started = false;
let modalOpen = false;
let resumeAfterModal = false;
let transitionTimer: number | null = null;

const mobileControls = new MobileControls(mobileControlsRoot, {
  onMove(x, forward) {
    game?.setMobileMove(x, forward);
  },
  onLook(yawDelta, pitchDelta) {
    game?.addMobileLook(yawDelta, pitchDelta);
  },
  onInteract() {
    game?.interact();
  },
  onFlashlight() {
    game?.toggleFlashlight();
  },
  onJournal() {
    game?.openJournal();
  },
});

if (mobileMode) {
  controlsCopy.textContent = "Стик · свайп · кнопки действий";
}

startButton.addEventListener("click", () => {
  if (!game) return;
  startScreen.classList.add("hidden");
  showGameControls();
  startButton.textContent = "Продолжить";
  void sound.resume();
  if (mobileMode) void enterFullscreen();
  game.start();
  platform.gameplayStart();
  started = true;
});

levelCards.forEach((card) => {
  card.addEventListener("click", () => {
    const level = Number(card.dataset.level) as GameLevel;
    if (![1, 2, 3, 4].includes(level)) return;
    void selectLevel(level);
  });
});

noteCloseButton.addEventListener("click", () => closeModal(noteScreen));
journalCloseButton.addEventListener("click", () => closeModal(journalScreen));
journalButton.addEventListener("click", openJournal);

soundToggleButton.addEventListener("click", () => {
  const muted = sound.toggleMuted();
  soundToggleButton.textContent = muted ? "Звук: выкл." : "Звук: вкл.";
  soundToggleButton.setAttribute("aria-pressed", String(muted));
});

retryButton.addEventListener("click", () => {
  if (!game) return;
  caughtScreen.classList.add("hidden");
  showGameControls();
  modalOpen = false;
  void sound.resume();
  game.restart();
  platform.gameplayStart();
});

document.addEventListener("pointerlockchange", () => {
  if (!mobileMode && started && !modalOpen && document.pointerLockElement !== canvas) pauseGame();
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) pauseGame();
});

void bootstrap();

async function bootstrap(): Promise<void> {
  try {
    saveData = await platform.load();
    saveData = {
      ...saveData,
      unlockedLevel: Math.max(saveData.unlockedLevel, unlockedLevelForProgress(saveData.levelOne)),
    };
    renderJournal(saveData.levelOne);
    game = createPrototype(
      canvas,
      {
        onObjectiveChange(message) {
          objective.textContent = message;
        },
        onStatusChange(message) {
          status.textContent = message;
        },
        onPromptChange(message) {
          interactionPrompt.textContent = message ?? "";
          interactionPrompt.classList.toggle("hidden", !message);
        },
        onNoteOpen(title, body) {
          noteTitle.textContent = title;
          noteBody.textContent = body;
          openModal(noteScreen, true);
          noteCloseButton.focus();
        },
        onJournalOpen() {
          openJournal();
        },
        onProgressChange(progress) {
          persistProgress(progress);
        },
        onInventoryChange(itemIds) {
          renderInventory(itemIds);
        },
        onLivesChange(livesRemaining) {
          renderLives(livesRemaining);
        },
        onBossHealthChange(health, maximum, visible) {
          bossHud.classList.toggle("hidden", !visible);
          bossHealthFill.style.transform = `scaleX(${maximum > 0 ? health / maximum : 0})`;
          bossHealthValue.textContent = `${health}/${maximum}`;
        },
        onZoneTransition(title, subtitle) {
          showZoneTransition(title, subtitle);
        },
        onFlashlightChange(charge, enabled) {
          const rounded = Math.max(0, Math.ceil(charge));
          flashlightChargeFill.style.transform = `scaleX(${charge / 100})`;
          flashlightChargeFill.classList.toggle("low", charge <= 20);
          flashlightValue.textContent = enabled ? `${rounded}%` : `${rounded}% · выкл.`;
        },
        onAudioEvent(event) {
          sound.play(event);
        },
        onCaught(livesRemaining, resetRequired) {
          modalOpen = true;
          resumeAfterModal = false;
          hideGameControls();
          caughtScreen.classList.remove("hidden");
          caughtMessage.textContent = resetRequired
            ? "Попытки закончились. Прогресс текущего уровня будет сброшен."
            : `Осталось попыток: ${livesRemaining}. Вы вернётесь к контрольной точке.`;
          retryButton.textContent = resetRequired ? "Начать уровень заново" : "Продолжить с контрольной точки";
          platform.gameplayStop();
          void sound.pause();
          retryButton.focus();
        },
        onEscape() {
          pauseGame();
        },
      },
      saveData.levelOne,
      { mobileControls: mobileMode, transitionDuration: qaRequested ? 0.05 : 1.4 },
    );
    await platform.ready();
    if (qaRequested) {
      (window as Window & {
        __liminalHuntQa?: {
          state(): PrototypeDebugState;
          previewVerityFace(face: "normal" | "chase", view?: "front" | "angle"): void;
          teleportForQa(
            target:
              | "key"
              | "note"
              | "battery"
              | "door"
              | "valve-1"
              | "valve-2"
              | "valve-3"
              | "pipe-exit"
              | "mine-pickaxe"
              | "mine-anchor-1"
              | "mine-anchor-2"
              | "mine-anchor-3"
              | "mine-note-1"
              | "mine-note-2"
              | "mine-lava"
              | "mine-exit"
              | "lab-terminal-1"
              | "lab-terminal-2"
              | "lab-terminal-3"
              | "lab-note"
              | "lab-exit"
              | "boss-weapon",
          ): void;
          triggerCatchForQa(): void;
          shootForQa(): void;
          destroyBossRelayForQa(): void;
          prepareBossShotForQa(): void;
        };
      }).__liminalHuntQa = {
        state: () => game!.getDebugState(),
        previewVerityFace: (face, view) => game!.previewVerityFace(face, view),
        teleportForQa: (target) => game!.teleportForQa(target),
        triggerCatchForQa: () => game!.triggerCatchForQa(),
        shootForQa: () => game!.shootForQa(),
        destroyBossRelayForQa: () => game!.destroyBossRelayForQa(),
        prepareBossShotForQa: () => game!.prepareBossShotForQa(),
      };
    }
    renderMenu(saveData);
    if (autoStartPreview) startButton.click();
  } catch (error) {
    console.error(error);
    status.textContent = "Не удалось инициализировать игру.";
    startButton.textContent = "Ошибка запуска";
  }
}

function persistProgress(progress: LevelOneProgress): void {
  if (!saveData) return;
  saveData = {
    ...saveData,
    unlockedLevel: Math.max(saveData.unlockedLevel, unlockedLevelForProgress(progress)),
    levelOne: progress,
  };
  renderMenu(saveData);
  renderJournal(progress);
  void platform.save(saveData).catch((error: unknown) => {
    console.error("Save failed", error);
    status.textContent = "Не удалось сохранить прогресс.";
  });
}

async function selectLevel(level: GameLevel): Promise<void> {
  if (!saveData || level > saveData.unlockedLevel) return;
  levelCards.forEach((card) => {
    card.disabled = true;
  });
  startButton.disabled = true;
  startButton.textContent = "Подготовка уровня…";
  saveData = {
    ...saveData,
    levelOne: createProgressForLevel(level),
  };
  await platform.save(saveData);
  window.location.reload();
}

function renderMenu(data: SaveData): void {
  const unlockedLevel = Math.max(1, Math.min(4, data.unlockedLevel));
  const currentLevel = unlockedLevelForProgress(data.levelOne);
  menuCurrentZone.textContent = zoneLabel(data.levelOne.zone);
  menuUnlockedCount.textContent = `${unlockedLevel}/4`;
  levelCards.forEach((card) => {
    const level = Number(card.dataset.level);
    const unlocked = level <= unlockedLevel;
    card.disabled = !unlocked;
    card.classList.toggle("current", level === currentLevel);
    const state = card.querySelector<HTMLElement>(".level-state");
    if (state) state.textContent = unlocked ? (level === currentLevel ? "Сейчас" : "") : "Закрыт";
  });
  const hasProgress =
    data.levelOne.zone !== "yellow-rooms" ||
    data.levelOne.keyCollected ||
    data.levelOne.noteIds.length > 0 ||
    data.levelOne.batteryCollected;
  startButton.disabled = false;
  startButton.textContent = hasProgress ? "Продолжить игру" : "Начать игру";
}

function showZoneTransition(title: string, subtitle: string): void {
  if (transitionTimer !== null) window.clearTimeout(transitionTimer);
  transitionKicker.textContent = title.startsWith("ФИНАЛ") ? "ПОСЛЕДНИЙ СПУСК" : "НОВЫЙ МАРШРУТ";
  transitionTitle.textContent = title;
  transitionSubtitle.textContent = subtitle;
  zoneTransition.classList.remove("hidden");
  transitionTimer = window.setTimeout(() => {
    zoneTransition.classList.add("hidden");
    transitionTimer = null;
  }, 1420);
}

function zoneLabel(zone: LevelOneProgress["zone"]): string {
  if (zone === "pipe-dreams") return "Водопровод мечты";
  if (zone === "block-mines") return "Кубические шахты";
  if (zone === "observation-lab") return "Лаборатория наблюдения";
  if (zone === "boss-arena") return "Камера подавления";
  return "Жёлтые комнаты";
}

function openJournal(): void {
  if (!saveData || modalOpen) return;
  renderJournal(saveData.levelOne);
  openModal(journalScreen, started && startScreen.classList.contains("hidden"));
  journalCloseButton.focus();
}

function openModal(element: HTMLElement, shouldResume: boolean): void {
  if (modalOpen) return;
  modalOpen = true;
  resumeAfterModal = shouldResume;
  element.classList.remove("hidden");
  if (shouldResume && game) {
    hideGameControls();
    game.pause();
    platform.gameplayStop();
    void sound.pause();
  }
}

function closeModal(element: HTMLElement): void {
  element.classList.add("hidden");
  modalOpen = false;
  if (resumeAfterModal && game) {
    resumeAfterModal = false;
    void sound.resume();
    game.start();
    showGameControls();
    platform.gameplayStart();
  } else {
    resumeAfterModal = false;
    startButton.focus();
  }
}

function renderJournal(progress: LevelOneProgress): void {
  const notesFound = progress.noteIds.length;
  const keyText = progress.keyCollected ? "ключ найден" : "ключ не найден";
  const completionText = progress.completed ? "Верити побеждён" : "побег не завершён";
  const batteryText = progress.batteryCollected ? "батарея найдена" : "батарея не найдена";
  const zoneText =
    progress.zone === "pipe-dreams"
      ? "Водопровод мечты"
      : progress.zone === "block-mines"
        ? "Кубические шахты"
        : progress.zone === "observation-lab"
          ? "Лаборатория наблюдения"
          : progress.zone === "boss-arena"
            ? "Камера подавления"
            : "Жёлтые комнаты";
  journalProgress.textContent = `Зона: ${zoneText} · Попытки: ${progress.livesRemaining}/3 · Записки: ${notesFound}/4 · ${keyText} · вентили ${progress.activatedValveIds.length}/3 · якоря ${progress.destroyedMineAnchorIds.length}/3 · контуры ${progress.activatedLabTerminalIds.length}/3 · Верити ${progress.bossHealth}/8 · ${batteryText} · заряд ${Math.ceil(progress.flashlightCharge)}% · ${completionText}`;
  journalNotes.replaceChildren();

  if (progress.noteIds.length === 0) {
    const empty = document.createElement("p");
    empty.className = "journal-empty";
    empty.textContent = "Записок пока нет. Осматривайте ящики и столы в коридорах.";
    journalNotes.append(empty);
    return;
  }

  [NOTE_01, NOTE_02, NOTE_03, NOTE_04]
    .filter((note) => progress.noteIds.includes(note.id))
    .forEach((note) => {
      const entry = document.createElement("article");
      entry.className = "journal-entry";
      const title = document.createElement("h3");
      title.textContent = note.title;
      const body = document.createElement("p");
      body.textContent = note.body;
      entry.append(title, body);
      journalNotes.append(entry);
    });
}

function renderInventory(itemIds: readonly string[]): void {
  const labels = itemIds.map((id) => INVENTORY_ITEMS[id]?.label ?? id);
  inventoryItems.textContent = labels.length > 0 ? labels.join(" · ") : "Пусто";
  inventoryItems.classList.toggle("has-items", labels.length > 0);
}

function renderLives(livesRemaining: number): void {
  livesValue.textContent = [0, 1, 2].map((index) => (index < livesRemaining ? "●" : "○")).join(" ");
}

function pauseGame(): void {
  if (!started || modalOpen || !game) return;
  game.pause();
  platform.gameplayStop();
  void sound.pause();
  startScreen.classList.remove("hidden");
  hideGameControls();
}

function showGameControls(): void {
  if (mobileMode) {
    mobileControls.show();
    quickActions.classList.add("hidden");
  } else {
    mobileControls.hide();
    quickActions.classList.remove("hidden");
  }
}

function hideGameControls(): void {
  mobileControls.hide();
  quickActions.classList.add("hidden");
}

async function enterFullscreen(): Promise<void> {
  if (document.fullscreenElement || !document.documentElement.requestFullscreen) return;
  try {
    await document.documentElement.requestFullscreen();
  } catch {
    // Встроенные браузеры могут управлять полноэкранным режимом самостоятельно.
  }
}

function requiredElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Element #${id} not found`);
  return element as T;
}
