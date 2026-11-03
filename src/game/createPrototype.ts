import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import "@babylonjs/core/Collisions/collisionCoordinator";
import { Ray } from "@babylonjs/core/Culling/ray";
import { Engine } from "@babylonjs/core/Engines/engine";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { PointLight } from "@babylonjs/core/Lights/pointLight";
import { SpotLight } from "@babylonjs/core/Lights/spotLight";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { CreateDecal } from "@babylonjs/core/Meshes/Builders/decalBuilder";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Scene } from "@babylonjs/core/scene";
import type { GameAudioEvent } from "../audio/soundManager";
import {
  createBlockMine,
  MINE_EXIT_POSITION,
  MINE_PLAYER_START,
  MINE_VERITY_START,
} from "./createBlockMine";
import {
  BOSS_PLAYER_START,
  BOSS_VERITY_START,
  createBossArena,
} from "./createBossArena";
import {
  createObservationLab,
  LAB_EXIT_POSITION,
  LAB_PLAYER_START,
  LAB_VERITY_START,
} from "./createObservationLab";
import { InteractionSystem } from "./interactionSystem";
import {
  BOSS_MAX_HEALTH,
  BOSS_WEAPON_ITEM_ID,
  EXIT_KEY_ITEM_ID,
  LAB_TERMINAL_IDS,
  MINE_ANCHOR_IDS,
  MINE_PICKAXE_ITEM_ID,
  NOTE_01,
  NOTE_01_ID,
  NOTE_02,
  NOTE_02_ID,
  NOTE_03,
  NOTE_03_ID,
  NOTE_04,
  NOTE_04_ID,
  PIPE_VALVE_IDS,
  type LevelOneProgress,
  type LevelOneZone,
} from "./progress";
import { VerityController, type VerityState, type WallSpec } from "./verityController";
import {
  createBackroomsWallpaperMaterial,
  createCeilingTileMaterial,
  createDampCarpetMaterial,
  createPipeDreamsConcreteMaterial,
  createVoxelMaterial,
} from "./voxelMaterials";

type PrototypeCallbacks = {
  onObjectiveChange(message: string): void;
  onStatusChange(message: string): void;
  onPromptChange(message: string | null): void;
  onNoteOpen(title: string, body: string): void;
  onJournalOpen(): void;
  onProgressChange(progress: LevelOneProgress): void;
  onInventoryChange(itemIds: readonly string[]): void;
  onLivesChange(livesRemaining: number): void;
  onBossHealthChange(health: number, maximum: number, visible: boolean): void;
  onZoneTransition(title: string, subtitle: string): void;
  onFlashlightChange(charge: number, enabled: boolean): void;
  onAudioEvent(event: GameAudioEvent): void;
  onCaught(livesRemaining: number, resetRequired: boolean): void;
  onEscape(): void;
};

export type PrototypeGame = {
  start(): void;
  restart(): void;
  pause(): void;
  setMobileMove(x: number, forward: number): void;
  addMobileLook(yawDelta: number, pitchDelta: number): void;
  interact(): void;
  toggleFlashlight(): void;
  openJournal(): void;
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
  shootForQa(): void;
  destroyBossRelayForQa(): void;
  prepareBossShotForQa(): void;
  triggerCatchForQa(): void;
  getDebugState(): PrototypeDebugState;
  dispose(): void;
};

export type PrototypeDebugState = {
  running: boolean;
  playerHidden: boolean;
  player: { x: number; y: number; z: number; pitch: number; yaw: number };
  verity: { x: number; y: number; z: number };
  mobileMove: { x: number; forward: number };
  flashlight: { charge: number; enabled: boolean; intensity: number };
  verityFace: "normal" | "chase";
  inventoryItemIds: string[];
  zone: LevelOneZone;
  activatedValveIds: string[];
  destroyedMineAnchorIds: string[];
  activatedLabTerminalIds: string[];
  completed: boolean;
  livesRemaining: number;
  yellowRouteSteps: number;
  mineRouteSteps: number[];
  labRouteSteps: number[];
  mineAggression: number;
  labAggression: number;
  bossHealth: number;
  hasBossWeapon: boolean;
  bossPhase: number;
  bossMode: "dormant" | "shielded" | "vulnerable" | "defeated";
  activeBossRelayCount: number;
  bossProjectileCount: number;
  heldPickaxeVisible: boolean;
  anchorFragmentCount: number;
  actionCount: number;
};

type PrototypeOptions = {
  mobileControls: boolean;
  transitionDuration: number;
};

const PLAYER_START = new Vector3(-12, 1.7, -12);
const VERITY_START = new Vector3(10, 1.4, 9);
const YELLOW_DOOR_POSITION = new Vector3(0, 1.75, 14.35);
const PIPE_PLAYER_START = new Vector3(33, 1.7, -12);
const PIPE_VERITY_START = new Vector3(56, 1.4, -11);
const PIPE_EXIT_POSITION = new Vector3(49, 1.75, 14.35);
const BOSS_RELAY_PHASES: readonly (readonly number[])[] = [
  [0, 1, 2],
  [3, 4, 5],
  [0, 2, 4],
];
const BOSS_VULNERABILITY_SECONDS = 7.5;

export function createPrototype(
  canvas: HTMLCanvasElement,
  callbacks: PrototypeCallbacks,
  initialProgress: LevelOneProgress,
  options: PrototypeOptions,
): PrototypeGame {
  const engine = new Engine(canvas, true, {
    adaptToDeviceRatio: true,
    stencil: true,
  });
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.055, 0.052, 0.035, 1);
  scene.collisionsEnabled = true;
  scene.gravity = new Vector3(0, -0.22, 0);
  scene.fogMode = Scene.FOGMODE_LINEAR;
  scene.fogStart = 10;
  scene.fogEnd = 34;
  scene.fogColor = new Color3(0.085, 0.08, 0.045);

  const camera = new UniversalCamera("player", PLAYER_START.clone(), scene);
  // Movement is handled below for both keyboard and the virtual joystick. Keeping
  // a single path avoids Babylon input-map differences between desktop and touch.
  camera.inputs.removeByType("FreeCameraKeyboardMoveInput");
  if (!options.mobileControls) camera.attachControl(canvas, true);
  camera.speed = 0.28;
  camera.angularSensibility = 2600;
  camera.movement.panInertia = 0;
  camera.minZ = 0.08;
  camera.applyGravity = true;
  camera.checkCollisions = true;
  camera.ellipsoid = new Vector3(0.45, 0.85, 0.45);
  camera.keysUp = [87, 38];
  camera.keysDown = [83, 40];
  camera.keysLeft = [65, 37];
  camera.keysRight = [68, 39];

  const light = new HemisphericLight("ambient", new Vector3(0.2, 1, 0.1), scene);
  light.intensity = 0.38;
  light.diffuse = new Color3(1, 0.94, 0.68);
  light.groundColor = new Color3(0.09, 0.085, 0.055);

  const floorMaterial = createDampCarpetMaterial(scene);
  const wallMaterial = createBackroomsWallpaperMaterial(scene);
  const ceilingMaterial = createCeilingTileMaterial(scene);
  const keyMaterial = material(scene, "key-mat", new Color3(0.44, 0.31, 0.08));
  keyMaterial.specularColor = new Color3(0.28, 0.22, 0.1);
  keyMaterial.specularPower = 48;
  const doorMaterial = material(scene, "door-mat", new Color3(0.18, 0.22, 0.23), true);
  const verityMaterial = material(scene, "verity-mat", new Color3(0.92, 0.72, 0.06), true);
  const lockerMaterial = createVoxelMaterial(
    scene,
    "locker-mat",
    { base: "#30383a", light: "#3a4446", dark: "#1c2224", mortar: "#101416" },
    3,
  );
  const batteryMaterial = material(scene, "battery-mat", new Color3(0.22, 0.75, 0.32), true);

  const flashlight = new SpotLight(
    "flashlight",
    Vector3.Zero(),
    new Vector3(0, 0, 1),
    Math.PI / 3.1,
    2.2,
    scene,
  );
  flashlight.parent = camera;
  flashlight.intensity = 3.2;
  flashlight.diffuse = new Color3(1, 0.92, 0.72);
  flashlight.specular = new Color3(0.3, 0.25, 0.16);
  flashlight.range = 18;

  const floor = MeshBuilder.CreateGround("floor", { width: 30, height: 30 }, scene);
  floor.material = floorMaterial;
  floor.checkCollisions = true;

  const ceiling = MeshBuilder.CreateGround("ceiling", { width: 30, height: 30 }, scene);
  ceiling.position.y = 4;
  ceiling.rotation.x = Math.PI;
  ceiling.material = ceilingMaterial;

  const fluorescentMaterial = material(
    scene,
    "fluorescent-panel-mat",
    new Color3(1, 0.9, 0.48),
    true,
  );
  const fluorescentPositions = [
    new Vector3(-11, 3.91, -10),
    new Vector3(-11, 3.91, 7),
    new Vector3(-3, 3.91, -7),
    new Vector3(3, 3.91, 7),
    new Vector3(11, 3.91, -8),
    new Vector3(11, 3.91, 9),
  ];
  fluorescentPositions.forEach((position, index) => {
    const panel = MeshBuilder.CreateBox(
      `fluorescent-panel-${index}`,
      { width: 2.8, height: 0.07, depth: 0.72 },
      scene,
    );
    panel.position.copyFrom(position);
    panel.material = fluorescentMaterial;
    if (index % 2 === 0) {
      const panelLight = new PointLight(
        `fluorescent-light-${index}`,
        position.add(new Vector3(0, -0.25, 0)),
        scene,
      );
      panelLight.diffuse = new Color3(1, 0.86, 0.46);
      panelLight.intensity = 0.34;
      panelLight.range = 8;
    }
  });

  const noteMaterial = material(scene, "note-mat", new Color3(0.85, 0.82, 0.65), true);
  const crateMaterial = material(scene, "crate-mat", new Color3(0.18, 0.12, 0.07));

  const yellowWallSpecs: WallSpec[] = [
    [0, -15, 30, 1],
    [0, 15, 30, 1],
    [-15, 0, 1, 30],
    [15, 0, 1, 30],
    [-7, -4, 1, 14],
    [0, 4, 1, 14],
    [7, -4, 1, 14],
  ];
  yellowWallSpecs.forEach(([x, z, width, depth], index) => {
    const wall = MeshBuilder.CreateBox(`wall-${index}`, { width, depth, height: 4 }, scene);
    wall.position.set(x, 2, z);
    wall.material = wallMaterial;
    wall.checkCollisions = true;
    wall.metadata = { blocksVision: true };
  });

  const pipeWallMaterial = createPipeDreamsConcreteMaterial(scene, "pipe-concrete-wall");
  const pipeFloorMaterial = createPipeDreamsConcreteMaterial(scene, "pipe-concrete-floor", 18);
  const pipeMetalMaterial = material(scene, "pipe-metal-mat", new Color3(0.22, 0.25, 0.26));
  const pipeExitMaterial = material(scene, "pipe-exit-mat", new Color3(0.28, 0.09, 0.07), true);
  const valveBodyMaterial = material(scene, "valve-body-mat", new Color3(0.18, 0.2, 0.2));
  const valveInactiveMaterial = material(scene, "valve-inactive-mat", new Color3(0.3, 0.1, 0.055));
  const valveActiveMaterial = material(scene, "valve-active-mat", new Color3(0.07, 0.28, 0.15));
  const valveIndicatorActiveMaterial = material(
    scene,
    "valve-indicator-active-mat",
    new Color3(0.05, 0.62, 0.25),
    true,
  );
  const emergencyLightMaterial = material(scene, "emergency-light-mat", new Color3(0.8, 0.05, 0.025), true);

  const pipeFloor = MeshBuilder.CreateGround("pipe-floor", { width: 30, height: 30 }, scene);
  pipeFloor.position.x = 45;
  pipeFloor.material = pipeFloorMaterial;
  pipeFloor.checkCollisions = true;

  const pipeCeiling = MeshBuilder.CreateGround("pipe-ceiling", { width: 30, height: 30 }, scene);
  pipeCeiling.position.set(45, 4, 0);
  pipeCeiling.rotation.x = Math.PI;
  pipeCeiling.material = pipeWallMaterial;

  const pipeWallSpecs: WallSpec[] = [
    [45, -15, 30, 1],
    [45, 15, 30, 1],
    [30, 0, 1, 30],
    [60, 0, 1, 30],
    [37, -6, 1, 18],
    [37, 10, 1, 10],
    [45, -8, 1, 14],
    [45, 8, 1, 14],
    [53, -6, 1, 18],
    [53, 10, 1, 10],
  ];
  pipeWallSpecs.forEach(([x, z, width, depth], index) => {
    const wall = MeshBuilder.CreateBox(`pipe-wall-${index}`, { width, depth, height: 4 }, scene);
    wall.position.set(x, 2, z);
    wall.material = pipeWallMaterial;
    wall.checkCollisions = true;
    wall.metadata = { blocksVision: true };
  });

  const pipeRuns = [
    { position: new Vector3(45, 3.28, -13.2), height: 27, rotation: new Vector3(0, 0, Math.PI / 2) },
    { position: new Vector3(45, 2.92, -12.5), height: 27, rotation: new Vector3(0, 0, Math.PI / 2) },
    { position: new Vector3(31.4, 2.7, 0), height: 27, rotation: new Vector3(Math.PI / 2, 0, 0) },
    { position: new Vector3(58.6, 3.15, 0), height: 27, rotation: new Vector3(Math.PI / 2, 0, 0) },
    { position: new Vector3(35.8, 2.8, 0), height: 27, rotation: new Vector3(Math.PI / 2, 0, 0) },
    { position: new Vector3(52.2, 3.05, 0), height: 27, rotation: new Vector3(Math.PI / 2, 0, 0) },
  ];
  pipeRuns.forEach((run, index) => {
    const pipe = MeshBuilder.CreateCylinder(
      `pipe-run-${index}`,
      { diameter: index % 2 === 0 ? 0.34 : 0.24, height: run.height, tessellation: 12 },
      scene,
    );
    pipe.position.copyFrom(run.position);
    pipe.rotation.copyFrom(run.rotation);
    pipe.material = pipeMetalMaterial;
  });

  [34, 45, 56].forEach((x, index) => {
    const lamp = MeshBuilder.CreateBox(
      `emergency-lamp-${index}`,
      { width: 0.55, height: 0.18, depth: 0.28 },
      scene,
    );
    lamp.position.set(x, 3.45, index === 1 ? 1 : -10);
    lamp.material = emergencyLightMaterial;
    const emergencyLight = new PointLight(
      `emergency-point-${index}`,
      lamp.position.add(new Vector3(0, -0.25, 0)),
      scene,
    );
    emergencyLight.diffuse = new Color3(1, 0.08, 0.025);
    emergencyLight.intensity = 0.55;
    emergencyLight.range = 7;
  });

  const valvePositions = [
    new Vector3(34.2, 1.25, -3),
    new Vector3(41.5, 1.25, 5),
    new Vector3(56.2, 1.25, 8),
  ];
  const pipeValves = PIPE_VALVE_IDS.map((id, index) => {
    const mesh = new TransformNode(id, scene);
    mesh.position.copyFrom(valvePositions[index]);

    const mount = MeshBuilder.CreateCylinder(
      `${id}-mount`,
      { diameter: 0.42, height: 0.26, tessellation: 16 },
      scene,
    );
    mount.parent = mesh;
    mount.rotation.x = Math.PI / 2;
    mount.position.z = -0.08;
    mount.material = valveBodyMaterial;

    const wheel = MeshBuilder.CreateTorus(
      `${id}-wheel`,
      { diameter: 0.62, thickness: 0.085, tessellation: 16 },
      scene,
    );
    wheel.parent = mesh;
    wheel.position.z = 0.18;
    wheel.rotation.x = Math.PI / 2;

    const spokes = [0, Math.PI / 2].map((rotation, spokeIndex) => {
      const spoke = MeshBuilder.CreateBox(
        `${id}-spoke-${spokeIndex}`,
        { width: 0.49, height: 0.065, depth: 0.065 },
        scene,
      );
      spoke.parent = mesh;
      spoke.position.z = 0.18;
      spoke.rotation.z = rotation;
      return spoke;
    });

    const hub = MeshBuilder.CreateCylinder(
      `${id}-hub`,
      { diameter: 0.18, height: 0.24, tessellation: 14 },
      scene,
    );
    hub.parent = mesh;
    hub.position.z = 0.21;
    hub.rotation.x = Math.PI / 2;
    hub.material = valveBodyMaterial;

    const indicator = MeshBuilder.CreateBox(
      `${id}-indicator`,
      { width: 0.34, height: 0.14, depth: 0.08 },
      scene,
    );
    indicator.parent = mesh;
    indicator.position.set(0, 0.45, 0.05);

    return { id, mesh, wheel, spokes, indicator };
  });

  const setPipeValveState = (valve: (typeof pipeValves)[number], active: boolean) => {
    const stateMaterial = active ? valveActiveMaterial : valveInactiveMaterial;
    valve.wheel.material = stateMaterial;
    valve.spokes.forEach((spoke) => {
      spoke.material = stateMaterial;
    });
    valve.indicator.material = active ? valveIndicatorActiveMaterial : valveInactiveMaterial;
    valve.wheel.rotation.z = active ? Math.PI / 4 : 0;
    valve.spokes.forEach((spoke, spokeIndex) => {
      spoke.rotation.z = (active ? Math.PI / 4 : 0) + spokeIndex * (Math.PI / 2);
    });
  };
  pipeValves.forEach((valve) => {
    setPipeValveState(valve, initialProgress.activatedValveIds.includes(valve.id));
  });

  const pipeExitDoor = MeshBuilder.CreateBox(
    "pipe-exit-door",
    { width: 3, height: 3.5, depth: 0.3 },
    scene,
  );
  pipeExitDoor.position.copyFrom(PIPE_EXIT_POSITION);
  pipeExitDoor.material = pipeExitMaterial;
  pipeExitDoor.checkCollisions = true;
  pipeExitDoor.metadata = { blocksVision: true };

  const blockMine = createBlockMine(scene);
  const observationLab = createObservationLab(scene);
  const bossArena = createBossArena(scene);
  const heldPickaxeWoodMaterial = material(
    scene,
    "held-pickaxe-wood",
    new Color3(0.46, 0.23, 0.08),
    true,
  );
  const heldPickaxeIronMaterial = material(
    scene,
    "held-pickaxe-iron",
    new Color3(0.48, 0.56, 0.58),
    true,
  );
  const heldPickaxe = new TransformNode("held-pickaxe", scene);
  heldPickaxe.parent = camera;
  heldPickaxe.position.set(0.64, -0.58, 1.4);
  heldPickaxe.rotation.set(0.15, 0.15, -0.45);
  heldPickaxe.scaling.setAll(0.58);
  const heldPickaxeHandle = MeshBuilder.CreateBox(
    "held-pickaxe-handle",
    { width: 0.09, height: 0.95, depth: 0.09 },
    scene,
  );
  heldPickaxeHandle.parent = heldPickaxe;
  heldPickaxeHandle.material = heldPickaxeWoodMaterial;
  const heldPickaxeHead = MeshBuilder.CreateBox(
    "held-pickaxe-head",
    { width: 0.72, height: 0.13, depth: 0.14 },
    scene,
  );
  heldPickaxeHead.parent = heldPickaxe;
  heldPickaxeHead.position.y = 0.43;
  heldPickaxeHead.material = heldPickaxeIronMaterial;
  heldPickaxe.setEnabled(false);

  const heldBlaster = new TransformNode("held-blaster", scene);
  heldBlaster.parent = camera;
  heldBlaster.position.set(0.52, -0.43, 1.05);
  heldBlaster.rotation.set(-0.08, -0.08, -0.04);
  const blasterBodyMaterial = material(scene, "held-blaster-body", new Color3(0.19, 0.25, 0.29), true);
  const blasterEnergyMaterial = material(scene, "held-blaster-energy", new Color3(0.04, 0.64, 1), true);
  const blasterBody = MeshBuilder.CreateBox(
    "held-blaster-body",
    { width: 0.32, height: 0.3, depth: 0.95 },
    scene,
  );
  blasterBody.parent = heldBlaster;
  blasterBody.material = blasterBodyMaterial;
  const blasterBarrel = MeshBuilder.CreateBox(
    "held-blaster-barrel",
    { width: 0.17, height: 0.17, depth: 0.62 },
    scene,
  );
  blasterBarrel.parent = heldBlaster;
  blasterBarrel.position.set(0, 0.08, 0.68);
  blasterBarrel.material = blasterEnergyMaterial;
  const muzzleFlash = MeshBuilder.CreateSphere("held-blaster-flash", { diameter: 0.2, segments: 8 }, scene);
  muzzleFlash.parent = heldBlaster;
  muzzleFlash.position.set(0, 0.08, 1.04);
  muzzleFlash.material = blasterEnergyMaterial;
  muzzleFlash.setEnabled(false);
  heldBlaster.setEnabled(false);

  const steamMaterial = material(scene, "steam-mat", new Color3(0.72, 0.76, 0.77), true);
  steamMaterial.alpha = 0.22;
  steamMaterial.disableLighting = true;
  const steamPositions = [
    new Vector3(34, 1.45, 1),
    new Vector3(49, 1.45, -4),
    new Vector3(56, 1.45, 4),
  ];
  const steamJets = steamPositions.map((position, index) => {
    const cloud = MeshBuilder.CreateSphere(
      `steam-cloud-${index}`,
      { diameter: 1.5, segments: 10 },
      scene,
    );
    cloud.position.copyFrom(position);
    cloud.scaling.set(2.8, 1.4, 0.7);
    cloud.material = steamMaterial;
    cloud.isPickable = false;
    cloud.setEnabled(false);

    const blocker = MeshBuilder.CreateBox(
      `steam-blocker-${index}`,
      { width: 5.4, height: 3.1, depth: 0.55 },
      scene,
    );
    blocker.position.copyFrom(position);
    blocker.visibility = 0;
    blocker.isPickable = false;
    blocker.setEnabled(false);
    return { cloud, blocker, phaseOffset: index * 1.65, active: false };
  });

  const key = new TransformNode("key", scene);
  key.position.set(11, 1, -10);
  key.rotation.z = -0.12;

  const keyBow = MeshBuilder.CreateTorus(
    "key-bow",
    { diameter: 0.32, thickness: 0.07, tessellation: 18 },
    scene,
  );
  keyBow.parent = key;
  keyBow.position.x = -0.47;
  keyBow.rotation.x = Math.PI / 2;
  keyBow.material = keyMaterial;

  const keyShaft = MeshBuilder.CreateBox(
    "key-shaft",
    { width: 0.88, height: 0.09, depth: 0.08 },
    scene,
  );
  keyShaft.parent = key;
  keyShaft.position.x = 0.04;
  keyShaft.material = keyMaterial;

  const keyTip = MeshBuilder.CreateBox(
    "key-tip",
    { width: 0.12, height: 0.28, depth: 0.08 },
    scene,
  );
  keyTip.parent = key;
  keyTip.position.set(0.49, -0.09, 0);
  keyTip.material = keyMaterial;

  const keyTooth = MeshBuilder.CreateBox(
    "key-tooth",
    { width: 0.14, height: 0.17, depth: 0.08 },
    scene,
  );
  keyTooth.parent = key;
  keyTooth.position.set(0.28, -0.07, 0);
  keyTooth.material = keyMaterial;
  key.setEnabled(!initialProgress.keyCollected);

  const door = MeshBuilder.CreateBox("exit-door", { width: 3, height: 3.5, depth: 0.3 }, scene);
  door.position.copyFrom(YELLOW_DOOR_POSITION);
  door.material = doorMaterial;
  door.checkCollisions = true;
  door.metadata = { blocksVision: true };

  const crate = MeshBuilder.CreateBox("note-crate", { width: 1.2, height: 0.8, depth: 1 }, scene);
  crate.position.set(-11, 0.4, 5);
  crate.material = crateMaterial;
  crate.checkCollisions = true;

  const note = MeshBuilder.CreateBox("note", { width: 0.75, height: 0.035, depth: 0.5 }, scene);
  note.position.set(-11, 0.83, 5);
  note.rotation.y = 0.22;
  note.material = noteMaterial;
  note.setEnabled(!initialProgress.noteIds.includes(NOTE_01_ID));

  const battery = MeshBuilder.CreateCylinder(
    "flashlight-battery",
    { diameter: 0.34, height: 0.72, tessellation: 12 },
    scene,
  );
  battery.position.set(3, 0.75, 8);
  battery.rotation.z = Math.PI / 2;
  battery.material = batteryMaterial;
  battery.setEnabled(!initialProgress.batteryCollected);

  const hideSpots = [
    createLocker(scene, "locker-west", new Vector3(-11, 0, 8), lockerMaterial),
    createLocker(scene, "locker-east", new Vector3(10, 0, 8), lockerMaterial),
    createLocker(scene, "pipe-locker", new Vector3(57, 0, -2), lockerMaterial),
    createLocker(scene, "mine-locker-west", new Vector3(73, 0, -8), lockerMaterial),
    createLocker(scene, "mine-locker-east", new Vector3(108, 0, 8), lockerMaterial),
    createLocker(scene, "lab-locker-west", new Vector3(128, 0, 14), lockerMaterial),
    createLocker(scene, "lab-locker-east", new Vector3(160, 0, -7), lockerMaterial),
  ];

  const verity = MeshBuilder.CreateSphere("verity", { diameter: 1.8, segments: 32 }, scene);
  verity.position.copyFrom(VERITY_START);
  verity.material = verityMaterial;
  verity.checkCollisions = true;
  verity.ellipsoid = new Vector3(0.9, 0.9, 0.9);

  const normalFaceMaterial = createVerityFaceMaterial(
    scene,
    "verity-face-normal",
    "./assets/verity/face-normal.png",
  );
  const chaseFaceMaterial = createVerityFaceMaterial(
    scene,
    "verity-face-chase",
    "./assets/verity/face-chase.png",
  );
  const verityFace = createVerityFaceDecal(verity, normalFaceMaterial);
  bossArena.shieldMesh.parent = verity;
  bossArena.shieldMesh.position.set(0, 0, 0);

  let running = false;
  const inventoryItemIds = new Set(initialProgress.inventoryItemIds);
  if (initialProgress.keyCollected) inventoryItemIds.add(EXIT_KEY_ITEM_ID);
  let hasKey = inventoryItemIds.has(EXIT_KEY_ITEM_ID);
  key.setEnabled(!hasKey);
  let currentZone: LevelOneZone = initialProgress.completed ? "boss-arena" : initialProgress.zone;
  const activatedValveIds = new Set(initialProgress.activatedValveIds);
  const destroyedMineAnchorIds = new Set(initialProgress.destroyedMineAnchorIds);
  const activatedLabTerminalIds = new Set(initialProgress.activatedLabTerminalIds);
  let hasMinePickaxe = inventoryItemIds.has(MINE_PICKAXE_ITEM_ID);
  let hasBossWeapon = inventoryItemIds.has(BOSS_WEAPON_ITEM_ID);
  let bossHealth = initialProgress.completed ? 0 : initialProgress.bossHealth;
  let noteRead = initialProgress.noteIds.includes(NOTE_01_ID);
  let mineNoteOneRead = initialProgress.noteIds.includes(NOTE_02_ID);
  let mineNoteTwoRead = initialProgress.noteIds.includes(NOTE_03_ID);
  let labNoteRead = initialProgress.noteIds.includes(NOTE_04_ID);
  let levelCompleted = initialProgress.completed;
  let livesRemaining = initialProgress.livesRemaining;
  let flashlightCharge = initialProgress.flashlightCharge;
  let flashlightUserEnabled = flashlightCharge > 0;
  let batteryCollected = initialProgress.batteryCollected;
  let playerHidden = false;
  let activeHideSpot: HideSpot | null = null;
  let escaped = levelCompleted;
  let defeated = false;
  let interactRequested = false;
  let lastPrompt: string | null = null;
  let playerStepDistance = 0;
  let savedChargeBucket = Math.floor(flashlightCharge / 5);
  let reportedChargePercent = Math.ceil(flashlightCharge);
  let mobileMoveX = 0;
  let mobileMoveForward = 0;
  let actionCount = 0;
  let zoneTransitionTime = 0;
  let activeVerityFace: "normal" | "chase" = "normal";
  let steamWarningCooldown = 0;
  let pickaxeSwingTime = 0;
  let blasterCooldown = 0;
  let blasterRecoilTime = 0;
  let bossStunTime = 0;
  let bossPhase = bossPhaseForHealth(bossHealth);
  let bossMode: "dormant" | "shielded" | "vulnerable" | "defeated" =
    levelCompleted ? "defeated" : hasBossWeapon && currentZone === "boss-arena" ? "shielded" : "dormant";
  let bossVulnerabilityTime = 0;
  let bossDamageThisWindow = 0;
  let bossAttackCooldown = 1.8;
  let bossChargeCooldown = 5.5;
  let bossChargeWindup = 0;
  let bossChargeTime = 0;
  let bossOrbitAngle = 0;
  const bossChargeDirection = new Vector3(1, 0, 0);
  const activeBossRelays = new Set<number>();
  const bossProjectiles: Array<{ mesh: Mesh; velocity: Vector3; remaining: number }> = [];
  const anchorFragments: Array<{ mesh: Mesh; velocity: Vector3; remaining: number }> = [];
  const pressedMoveKeys = new Set<string>();
  const lastPlayerPosition = camera.position.clone();

  blockMine.pickaxeMeshes.forEach((mesh) => mesh.setEnabled(!hasMinePickaxe));
  bossArena.weaponMeshes.forEach((mesh) => mesh.setEnabled(!hasBossWeapon));
  blockMine.noteMeshes[0].setEnabled(!mineNoteOneRead);
  blockMine.noteMeshes[1].setEnabled(!mineNoteTwoRead);
  blockMine.anchors.forEach(({ id, mesh }) => {
    const destroyed = destroyedMineAnchorIds.has(id);
    mesh.material = destroyed ? blockMine.anchorDestroyedMaterial : blockMine.anchorActiveMaterial;
    mesh.scaling.setAll(destroyed ? 0.45 : 1);
  });
  observationLab.noteMesh.setEnabled(!labNoteRead);
  observationLab.terminals.forEach(({ id, screen }) => {
    screen.material = activatedLabTerminalIds.has(id)
      ? observationLab.terminalActiveMaterial
      : observationLab.terminalInactiveMaterial;
  });
  updateHeldPickaxeVisibility();
  updateHeldBlasterVisibility();
  updateMinePortalState();
  updateLabExitState();

  updateFlashlight();
  callbacks.onFlashlightChange(flashlightCharge, flashlightUserEnabled);
  callbacks.onInventoryChange([...inventoryItemIds]);
  callbacks.onLivesChange(livesRemaining);
  callbacks.onBossHealthChange(bossHealth, BOSS_MAX_HEALTH, currentZone === "boss-arena");

  const emitProgress = () => {
    callbacks.onProgressChange(
      currentProgress(
        hasKey,
        noteRead,
        levelCompleted,
        flashlightCharge,
        batteryCollected,
        [...inventoryItemIds],
        currentZone,
        [...activatedValveIds],
        [...destroyedMineAnchorIds],
        [...activatedLabTerminalIds],
        bossHealth,
        livesRemaining,
        mineNoteOneRead,
        mineNoteTwoRead,
        labNoteRead,
      ),
    );
  };

  const controllerEvents = {
    onStateChange(state) {
      const hunting = state === "chase" || state === "search";
      activeVerityFace = hunting ? "chase" : "normal";
      verityFace.material = hunting ? chaseFaceMaterial : normalFaceMaterial;
      verity.scaling.setAll(1);
      callbacks.onStatusChange(verityStateMessage(state));
      if (state === "chase") callbacks.onAudioEvent("verity-alert");
      if (state === "search") callbacks.onAudioEvent("verity-search");
    },
    onStep() {
      callbacks.onAudioEvent("verity-step");
    },
    onCaught: handleCaught,
  } satisfies Pick<
    ConstructorParameters<typeof VerityController>[0],
    "onStateChange" | "onStep" | "onCaught"
  >;

  const yellowVerityController = new VerityController({
    scene,
    mesh: verity,
    spawn: VERITY_START,
    wallSpecs: yellowWallSpecs,
    navigationBounds: { minX: -13, maxX: 13, minZ: -13, maxZ: 13 },
    patrolPoints: [
      new Vector3(10, 1.4, 9),
      new Vector3(10, 1.4, -12),
      new Vector3(3, 1.4, -12),
      new Vector3(3, 1.4, 12),
      new Vector3(-4, 1.4, 12),
      new Vector3(-4, 1.4, -12),
      new Vector3(-11, 1.4, -12),
      new Vector3(-11, 1.4, 11),
    ],
    ...controllerEvents,
  });
  const pipeVerityController = new VerityController({
    scene,
    mesh: verity,
    spawn: PIPE_VERITY_START,
    wallSpecs: pipeWallSpecs,
    navigationBounds: { minX: 32, maxX: 58, minZ: -13, maxZ: 13 },
    patrolPoints: [
      new Vector3(56, 1.4, -11),
      new Vector3(56, 1.4, 2),
      new Vector3(56, 1.4, 12),
      new Vector3(49, 1.4, 12),
      new Vector3(49, 1.4, 0),
      new Vector3(49, 1.4, -12),
      new Vector3(41, 1.4, -12),
      new Vector3(41, 1.4, 0),
      new Vector3(41, 1.4, 12),
      new Vector3(34, 1.4, 12),
      new Vector3(34, 1.4, 0),
      new Vector3(34, 1.4, -11),
    ],
    ...controllerEvents,
  });
  const mineVerityController = new VerityController({
    scene,
    mesh: verity,
    spawn: MINE_VERITY_START,
    wallSpecs: blockMine.wallSpecs,
    navigationBounds: { minX: 70, maxX: 110, minZ: -20, maxZ: 20 },
    patrolPoints: [
      new Vector3(108, 1.4, 16),
      new Vector3(107, 1.4, -18),
      new Vector3(99, 1.4, -18),
      new Vector3(99, 1.4, 18),
      new Vector3(88, 1.4, 18),
      new Vector3(88, 1.4, -18),
      new Vector3(73, 1.4, -18),
      new Vector3(73, 1.4, 18),
    ],
    ...controllerEvents,
  });
  mineVerityController.setAggression(destroyedMineAnchorIds.size);
  const labVerityController = new VerityController({
    scene,
    mesh: verity,
    spawn: LAB_VERITY_START,
    wallSpecs: observationLab.wallSpecs,
    navigationBounds: { minX: 126, maxX: 164, minZ: -15, maxZ: 15 },
    patrolPoints: [
      new Vector3(145, 1.4, 0),
      new Vector3(162, 1.4, 14),
      new Vector3(162, 1.4, -14),
      new Vector3(150, 1.4, -14),
      new Vector3(146, 1.4, 14),
      new Vector3(129, 1.4, 14),
      new Vector3(129, 1.4, -14),
    ],
    ...controllerEvents,
  });
  labVerityController.setAggression(activatedLabTerminalIds.size);
  const bossVerityController = new VerityController({
    scene,
    mesh: verity,
    spawn: BOSS_VERITY_START,
    wallSpecs: bossArena.wallSpecs,
    navigationBounds: { minX: 176, maxX: 204, minZ: -13, maxZ: 13 },
    patrolPoints: [
      new Vector3(202, 1.4, 0),
      new Vector3(200, 1.4, 12),
      new Vector3(190, 1.4, 12),
      new Vector3(178, 1.4, 10),
      new Vector3(178, 1.4, -10),
      new Vector3(190, 1.4, -12),
      new Vector3(200, 1.4, -12),
    ],
    ...controllerEvents,
  });
  bossVerityController.setAggression(bossAggressionStage(bossHealth));
  let activeVerityController = controllerForZone(currentZone);
  activeVerityController.reset(
    currentZone === "boss-arena" ? hasBossWeapon : currentZone !== "yellow-rooms" || hasKey,
  );
  if (currentZone === "pipe-dreams") {
    camera.position.copyFrom(PIPE_PLAYER_START);
    lastPlayerPosition.copyFrom(camera.position);
    door.position.y = -2;
    door.checkCollisions = false;
    door.metadata.blocksVision = false;
  }
  if (currentZone === "block-mines") {
    camera.position.copyFrom(MINE_PLAYER_START);
    lastPlayerPosition.copyFrom(camera.position);
    door.position.y = -2;
    door.checkCollisions = false;
    door.metadata.blocksVision = false;
    pipeExitDoor.position.y = -2;
    pipeExitDoor.checkCollisions = false;
    pipeExitDoor.metadata.blocksVision = false;
  }
  if (currentZone === "observation-lab") {
    camera.position.copyFrom(LAB_PLAYER_START);
    lastPlayerPosition.copyFrom(camera.position);
    door.position.y = -2;
    door.checkCollisions = false;
    door.metadata.blocksVision = false;
    pipeExitDoor.position.y = -2;
    pipeExitDoor.checkCollisions = false;
    pipeExitDoor.metadata.blocksVision = false;
    blockMine.exitPortal.position.y = -2;
    blockMine.exitPortal.checkCollisions = false;
    blockMine.exitPortal.metadata.blocksVision = false;
  }
  if (currentZone === "boss-arena") {
    camera.position.copyFrom(BOSS_PLAYER_START);
    lastPlayerPosition.copyFrom(camera.position);
    door.position.y = -2;
    door.checkCollisions = false;
    door.metadata.blocksVision = false;
    pipeExitDoor.position.y = -2;
    pipeExitDoor.checkCollisions = false;
    pipeExitDoor.metadata.blocksVision = false;
    blockMine.exitPortal.position.y = -2;
    blockMine.exitPortal.checkCollisions = false;
    blockMine.exitPortal.metadata.blocksVision = false;
    observationLab.exitDoor.position.y = -2;
    observationLab.exitDoor.checkCollisions = false;
    observationLab.exitDoor.metadata.blocksVision = false;
    verity.setEnabled(!levelCompleted && bossHealth > 0);
    if (levelCompleted) {
      bossMode = "defeated";
      setBossDormant();
      bossMode = "defeated";
    } else if (hasBossWeapon) {
      startBossFight(false);
    } else {
      setBossDormant();
    }
  } else {
    setBossDormant();
  }
  if (levelCompleted) {
    observationLab.exitDoor.position.y = -2;
    observationLab.exitDoor.checkCollisions = false;
    observationLab.exitDoor.metadata.blocksVision = false;
  }
  applyZoneAtmosphere();

  callbacks.onObjectiveChange(
    initialObjective(
      currentZone,
      hasKey,
      noteRead,
      levelCompleted,
      activatedValveIds.size,
      destroyedMineAnchorIds.size,
      hasMinePickaxe,
      activatedLabTerminalIds.size,
      bossHealth,
      hasBossWeapon,
    ),
  );
  if (hasKey || noteRead || levelCompleted || currentZone !== "yellow-rooms") {
    callbacks.onStatusChange("Восстановлен сохранённый прогресс.");
  }

  function controllerForZone(zone: LevelOneZone): VerityController {
    if (zone === "pipe-dreams") return pipeVerityController;
    if (zone === "block-mines") return mineVerityController;
    if (zone === "observation-lab") return labVerityController;
    if (zone === "boss-arena") return bossVerityController;
    return yellowVerityController;
  }

  function flashlightIsActive(): boolean {
    return flashlightUserEnabled && flashlightCharge > 0 && !playerHidden;
  }

  function handleCaught(cause: "verity" | "lava" = "verity"): void {
    if (defeated) return;
    if (currentZone === "boss-arena") {
      clearBossProjectiles();
      bossArena.chargeMarker.setEnabled(false);
    }
    defeated = true;
    running = false;
    livesRemaining = Math.max(0, livesRemaining - 1);
    callbacks.onLivesChange(livesRemaining);
    emitProgress();
    callbacks.onPromptChange(null);
    callbacks.onStatusChange(
      livesRemaining === 0
        ? cause === "lava"
          ? "Лава отняла последнюю попытку."
          : "Верити отнял последнюю попытку."
        : cause === "lava"
          ? "Вы наступили в лаву."
          : "Верити поймал вас.",
    );
    callbacks.onAudioEvent("caught");
    if (cause === "lava") callbacks.onAudioEvent("lava");
    callbacks.onCaught(livesRemaining, livesRemaining === 0);
    document.exitPointerLock?.();
  }

  function applyZoneAtmosphere(): void {
    scene.fogMode = Scene.FOGMODE_LINEAR;
    if (currentZone === "boss-arena") {
      scene.clearColor = new Color4(0.006, 0.009, 0.012, 1);
      scene.fogColor = new Color3(0.008, 0.012, 0.016);
      scene.fogStart = 16;
      scene.fogEnd = 42;
      light.intensity = 0.18;
      light.diffuse = new Color3(0.42, 0.52, 0.58);
      light.groundColor = new Color3(0.018, 0.022, 0.028);
      return;
    }
    if (currentZone === "observation-lab") {
      scene.clearColor = new Color4(0.012, 0.017, 0.02, 1);
      scene.fogColor = new Color3(0.018, 0.026, 0.03);
      scene.fogStart = 15;
      scene.fogEnd = 46;
      light.intensity = 0.22;
      light.diffuse = new Color3(0.52, 0.65, 0.65);
      light.groundColor = new Color3(0.025, 0.035, 0.04);
      return;
    }
    if (currentZone === "block-mines") {
      scene.clearColor = new Color4(0.018, 0.014, 0.02, 1);
      scene.fogColor = new Color3(0.025, 0.018, 0.028);
      scene.fogStart = 16;
      scene.fogEnd = 50;
      light.intensity = 0.2;
      light.diffuse = new Color3(0.64, 0.52, 0.44);
      light.groundColor = new Color3(0.04, 0.025, 0.045);
      return;
    }
    if (currentZone === "pipe-dreams") {
      scene.clearColor = new Color4(0.022, 0.025, 0.027, 1);
      scene.fogColor = new Color3(0.03, 0.034, 0.035);
      scene.fogStart = 12;
      scene.fogEnd = 40;
      light.intensity = 0.16;
      light.diffuse = new Color3(0.58, 0.62, 0.64);
      light.groundColor = new Color3(0.025, 0.028, 0.03);
      return;
    }
    scene.clearColor = new Color4(0.055, 0.052, 0.035, 1);
    scene.fogColor = new Color3(0.085, 0.08, 0.045);
    scene.fogStart = 10;
    scene.fogEnd = 34;
    light.intensity = 0.38;
    light.diffuse = new Color3(1, 0.94, 0.68);
    light.groundColor = new Color3(0.09, 0.085, 0.055);
  }

  function enterPipeDreams(): void {
    currentZone = "pipe-dreams";
    beginZoneTransition(
      "УРОВЕНЬ 1 · ВОДОПРОВОД МЕЧТЫ",
      "Служебная дверь захлопнулась. Впереди только пар, трубы и шаги Верити.",
    );
    updateHeldPickaxeVisibility();
    door.position.y = -2;
    door.checkCollisions = false;
    door.metadata.blocksVision = false;
    camera.position.copyFrom(PIPE_PLAYER_START);
    camera.rotation.set(0, 0, 0);
    lastPlayerPosition.copyFrom(camera.position);
    playerStepDistance = 0;
    activeVerityController = pipeVerityController;
    activeVerityController.reset(true);
    applyZoneAtmosphere();
    callbacks.onAudioEvent("door");
    callbacks.onObjectiveChange(
      initialObjective(
        currentZone,
        hasKey,
        noteRead,
        levelCompleted,
        activatedValveIds.size,
        destroyedMineAnchorIds.size,
        hasMinePickaxe,
      ),
    );
    callbacks.onStatusChange("Контрольная точка: «Водопровод мечты». Перекройте три аварийных вентиля.");
    emitProgress();
  }

  function enterBlockMines(): void {
    currentZone = "block-mines";
    beginZoneTransition(
      "УРОВЕНЬ 2 · КУБИЧЕСКИЕ ШАХТЫ",
      "Грузовой подъёмник уходит под землю. Портал откроется после уничтожения трёх якорей.",
    );
    livesRemaining = 3;
    callbacks.onLivesChange(livesRemaining);
    pipeExitDoor.position.y = -2;
    pipeExitDoor.checkCollisions = false;
    pipeExitDoor.metadata.blocksVision = false;
    camera.position.copyFrom(MINE_PLAYER_START);
    camera.rotation.set(0, 0, 0);
    lastPlayerPosition.copyFrom(camera.position);
    playerStepDistance = 0;
    activeVerityController = mineVerityController;
    mineVerityController.setAggression(destroyedMineAnchorIds.size);
    activeVerityController.reset(true);
    updateHeldPickaxeVisibility();
    updateMinePortalState();
    applyZoneAtmosphere();
    callbacks.onAudioEvent("door");
    callbacks.onObjectiveChange(
      initialObjective(
        currentZone,
        hasKey,
        noteRead,
        levelCompleted,
        activatedValveIds.size,
        destroyedMineAnchorIds.size,
        hasMinePickaxe,
      ),
    );
    callbacks.onStatusChange("Уровень 2: «Кубические шахты». Найдите кирку в лагере.");
    emitProgress();
  }

  function enterObservationLab(): void {
    currentZone = "observation-lab";
    beginZoneTransition(
      "УРОВЕНЬ 3 · ЛАБОРАТОРИЯ",
      "Шахтный портал выбросил вас в заброшенный комплекс наблюдения.",
    );
    livesRemaining = 3;
    callbacks.onLivesChange(livesRemaining);
    blockMine.exitPortal.position.y = -2;
    blockMine.exitPortal.checkCollisions = false;
    blockMine.exitPortal.metadata.blocksVision = false;
    camera.position.copyFrom(LAB_PLAYER_START);
    camera.rotation.set(0, 0, 0);
    lastPlayerPosition.copyFrom(camera.position);
    playerStepDistance = 0;
    activeVerityController = labVerityController;
    labVerityController.setAggression(activatedLabTerminalIds.size);
    activeVerityController.reset(true);
    updateHeldPickaxeVisibility();
    updateLabExitState();
    applyZoneAtmosphere();
    callbacks.onAudioEvent("elevator");
    callbacks.onObjectiveChange(
      initialObjective(
        currentZone,
        hasKey,
        noteRead,
        levelCompleted,
        activatedValveIds.size,
        destroyedMineAnchorIds.size,
        hasMinePickaxe,
        activatedLabTerminalIds.size,
      ),
    );
    callbacks.onStatusChange("Уровень 3: «Лаборатория наблюдения». Запустите три контура питания.");
    emitProgress();
  }

  function enterBossArena(): void {
    currentZone = "boss-arena";
    beginZoneTransition(
      "ФИНАЛ · КАМЕРА ПОДАВЛЕНИЯ",
      "Лифт опускается на последний этаж. На этот раз от Верити не нужно убегать.",
    );
    livesRemaining = 3;
    bossHealth = BOSS_MAX_HEALTH;
    levelCompleted = false;
    escaped = false;
    defeated = false;
    callbacks.onLivesChange(livesRemaining);
    callbacks.onBossHealthChange(bossHealth, BOSS_MAX_HEALTH, true);
    observationLab.exitDoor.position.y = -2;
    observationLab.exitDoor.checkCollisions = false;
    observationLab.exitDoor.metadata.blocksVision = false;
    camera.position.copyFrom(BOSS_PLAYER_START);
    camera.rotation.set(0, Math.PI / 2, 0);
    lastPlayerPosition.copyFrom(camera.position);
    playerStepDistance = 0;
    verity.setEnabled(true);
    activeVerityController = bossVerityController;
    bossVerityController.setAggression(0);
    activeVerityController.reset(hasBossWeapon);
    if (hasBossWeapon) startBossFight(false);
    else setBossDormant();
    bossArena.weaponMeshes.forEach((mesh) => mesh.setEnabled(!hasBossWeapon));
    updateHeldPickaxeVisibility();
    updateHeldBlasterVisibility();
    applyZoneAtmosphere();
    callbacks.onAudioEvent("elevator");
    callbacks.onObjectiveChange(
      hasBossWeapon
        ? `Фаза ${bossPhase}/3: уничтожьте три светящихся реле щита.`
        : "Возьмите импульсное ружьё с оружейной стойки.",
    );
    callbacks.onStatusChange("Финал: «Камера подавления». Ружьё разбудит Верити — цельтесь в шар и стреляйте.");
    emitProgress();
  }

  function beginZoneTransition(title: string, subtitle: string): void {
    zoneTransitionTime = Math.max(0, options.transitionDuration);
    pressedMoveKeys.clear();
    mobileMoveX = 0;
    mobileMoveForward = 0;
    interactRequested = false;
    lastPrompt = null;
    callbacks.onPromptChange(null);
    callbacks.onZoneTransition(title, subtitle);
  }

  function resetMineLevel(): void {
    livesRemaining = 3;
    hasMinePickaxe = false;
    hasBossWeapon = false;
    bossHealth = BOSS_MAX_HEALTH;
    mineNoteOneRead = false;
    mineNoteTwoRead = false;
    levelCompleted = false;
    escaped = false;
    defeated = false;
    inventoryItemIds.delete(MINE_PICKAXE_ITEM_ID);
    destroyedMineAnchorIds.clear();
    mineVerityController.setAggression(0);
    clearAnchorFragments();
    blockMine.pickaxeMeshes.forEach((mesh) => mesh.setEnabled(true));
    blockMine.noteMeshes.forEach((mesh) => mesh.setEnabled(true));
    blockMine.anchors.forEach(({ mesh }) => {
      mesh.material = blockMine.anchorActiveMaterial;
      mesh.scaling.setAll(1);
    });
    blockMine.exitPortal.position.copyFrom(MINE_EXIT_POSITION);
    blockMine.exitPortal.checkCollisions = true;
    blockMine.exitPortal.metadata.blocksVision = true;
    updateMinePortalState();
    flashlightCharge = 100;
    flashlightUserEnabled = true;
    reportedChargePercent = 100;
    savedChargeBucket = 20;
    camera.position.copyFrom(MINE_PLAYER_START);
    camera.rotation.set(0, 0, 0);
    lastPlayerPosition.copyFrom(camera.position);
    playerStepDistance = 0;
    activeVerityController = mineVerityController;
    activeVerityController.reset(true);
    updateHeldPickaxeVisibility();
    applyZoneAtmosphere();
    updateFlashlight();
    callbacks.onInventoryChange([...inventoryItemIds]);
    callbacks.onLivesChange(livesRemaining);
    callbacks.onFlashlightChange(flashlightCharge, true);
    callbacks.onPromptChange(null);
    callbacks.onObjectiveChange(
      initialObjective(
        currentZone,
        hasKey,
        noteRead,
        levelCompleted,
        activatedValveIds.size,
        destroyedMineAnchorIds.size,
        hasMinePickaxe,
      ),
    );
    callbacks.onStatusChange("Все попытки израсходованы. Кубические шахты начаты заново.");
    emitProgress();
  }

  function resetLabLevel(): void {
    livesRemaining = 3;
    labNoteRead = false;
    levelCompleted = false;
    escaped = false;
    defeated = false;
    activatedLabTerminalIds.clear();
    labVerityController.setAggression(0);
    observationLab.noteMesh.setEnabled(true);
    observationLab.terminals.forEach(({ screen }) => {
      screen.material = observationLab.terminalInactiveMaterial;
    });
    observationLab.exitDoor.position.copyFrom(LAB_EXIT_POSITION);
    observationLab.exitDoor.checkCollisions = true;
    observationLab.exitDoor.metadata.blocksVision = true;
    updateLabExitState();
    flashlightCharge = 100;
    flashlightUserEnabled = true;
    reportedChargePercent = 100;
    savedChargeBucket = 20;
    camera.position.copyFrom(LAB_PLAYER_START);
    camera.rotation.set(0, 0, 0);
    lastPlayerPosition.copyFrom(camera.position);
    playerStepDistance = 0;
    activeVerityController = labVerityController;
    activeVerityController.reset(true);
    updateHeldPickaxeVisibility();
    applyZoneAtmosphere();
    updateFlashlight();
    callbacks.onLivesChange(livesRemaining);
    callbacks.onFlashlightChange(flashlightCharge, true);
    callbacks.onPromptChange(null);
    callbacks.onObjectiveChange(
      initialObjective(
        currentZone,
        hasKey,
        noteRead,
        levelCompleted,
        activatedValveIds.size,
        destroyedMineAnchorIds.size,
        hasMinePickaxe,
        activatedLabTerminalIds.size,
      ),
    );
    callbacks.onStatusChange("Все попытки израсходованы. Лаборатория начата заново.");
    emitProgress();
  }

  function resetBossLevel(): void {
    livesRemaining = 3;
    bossHealth = BOSS_MAX_HEALTH;
    hasBossWeapon = false;
    levelCompleted = false;
    escaped = false;
    defeated = false;
    bossStunTime = 0;
    inventoryItemIds.delete(BOSS_WEAPON_ITEM_ID);
    bossArena.weaponMeshes.forEach((mesh) => mesh.setEnabled(true));
    verity.setEnabled(true);
    bossVerityController.setAggression(0);
    camera.position.copyFrom(BOSS_PLAYER_START);
    camera.rotation.set(0, Math.PI / 2, 0);
    lastPlayerPosition.copyFrom(camera.position);
    playerStepDistance = 0;
    activeVerityController = bossVerityController;
    activeVerityController.reset(false);
    setBossDormant();
    updateHeldPickaxeVisibility();
    updateHeldBlasterVisibility();
    applyZoneAtmosphere();
    updateFlashlight();
    callbacks.onInventoryChange([...inventoryItemIds]);
    callbacks.onLivesChange(livesRemaining);
    callbacks.onBossHealthChange(bossHealth, BOSS_MAX_HEALTH, true);
    callbacks.onPromptChange(null);
    callbacks.onObjectiveChange("Возьмите импульсное ружьё с оружейной стойки.");
    callbacks.onStatusChange("Все попытки израсходованы. Финальное сражение начато заново.");
    emitProgress();
  }

  function resetEntireLevel(): void {
    currentZone = "yellow-rooms";
    livesRemaining = 3;
    hasKey = false;
    hasMinePickaxe = false;
    noteRead = false;
    mineNoteOneRead = false;
    mineNoteTwoRead = false;
    labNoteRead = false;
    batteryCollected = false;
    levelCompleted = false;
    escaped = false;
    defeated = false;
    inventoryItemIds.clear();
    activatedValveIds.clear();
    destroyedMineAnchorIds.clear();
    activatedLabTerminalIds.clear();
    mineVerityController.setAggression(0);
    labVerityController.setAggression(0);
    bossVerityController.setAggression(0);
    clearAnchorFragments();
    key.setEnabled(true);
    note.setEnabled(true);
    battery.setEnabled(true);
    blockMine.pickaxeMeshes.forEach((mesh) => mesh.setEnabled(true));
    blockMine.noteMeshes.forEach((mesh) => mesh.setEnabled(true));
    blockMine.anchors.forEach(({ mesh }) => {
      mesh.material = blockMine.anchorActiveMaterial;
      mesh.scaling.setAll(1);
    });
    observationLab.noteMesh.setEnabled(true);
    observationLab.terminals.forEach(({ screen }) => {
      screen.material = observationLab.terminalInactiveMaterial;
    });
    bossArena.weaponMeshes.forEach((mesh) => mesh.setEnabled(true));
    verity.setEnabled(true);
    setBossDormant();
    pipeValves.forEach((valve) => setPipeValveState(valve, false));
    door.position.copyFrom(YELLOW_DOOR_POSITION);
    door.checkCollisions = true;
    door.metadata.blocksVision = true;
    pipeExitDoor.position.copyFrom(PIPE_EXIT_POSITION);
    pipeExitDoor.checkCollisions = true;
    pipeExitDoor.metadata.blocksVision = true;
    blockMine.exitPortal.position.copyFrom(MINE_EXIT_POSITION);
    blockMine.exitPortal.checkCollisions = true;
    blockMine.exitPortal.metadata.blocksVision = true;
    updateMinePortalState();
    observationLab.exitDoor.position.copyFrom(LAB_EXIT_POSITION);
    observationLab.exitDoor.checkCollisions = true;
    observationLab.exitDoor.metadata.blocksVision = true;
    updateLabExitState();
    flashlightCharge = 100;
    flashlightUserEnabled = true;
    reportedChargePercent = 100;
    savedChargeBucket = 20;
    camera.position.copyFrom(PLAYER_START);
    camera.rotation.set(0, 0, 0);
    lastPlayerPosition.copyFrom(camera.position);
    playerStepDistance = 0;
    activeVerityController = yellowVerityController;
    activeVerityController.reset(false);
    updateHeldPickaxeVisibility();
    updateHeldBlasterVisibility();
    applyZoneAtmosphere();
    updateFlashlight();
    callbacks.onInventoryChange([]);
    callbacks.onLivesChange(livesRemaining);
    callbacks.onBossHealthChange(bossHealth, BOSS_MAX_HEALTH, false);
    callbacks.onFlashlightChange(flashlightCharge, true);
    callbacks.onPromptChange(null);
    callbacks.onObjectiveChange(
      initialObjective(
        currentZone,
        hasKey,
        noteRead,
        levelCompleted,
        activatedValveIds.size,
        destroyedMineAnchorIds.size,
        hasMinePickaxe,
      ),
    );
    callbacks.onStatusChange("Все попытки израсходованы. Уровень начат заново.");
    emitProgress();
  }

  function resetCurrentLevel(): void {
    if (currentZone === "boss-arena") {
      resetBossLevel();
      return;
    }
    if (currentZone === "observation-lab") {
      resetLabLevel();
      return;
    }
    if (currentZone === "block-mines") {
      resetMineLevel();
      return;
    }
    resetEntireLevel();
  }

  function updateFlashlight(): void {
    flashlight.intensity = flashlightIsActive() ? 3.2 : 0;
  }

  function updateHeldPickaxeVisibility(): void {
    heldPickaxe.setEnabled(currentZone === "block-mines" && hasMinePickaxe && !levelCompleted);
  }

  function updateHeldBlasterVisibility(): void {
    heldBlaster.setEnabled(currentZone === "boss-arena" && hasBossWeapon && !levelCompleted);
  }

  function shootBlaster(directionOverride?: Vector3): void {
    if (
      !running ||
      currentZone !== "boss-arena" ||
      !hasBossWeapon ||
      levelCompleted ||
      blasterCooldown > 0
    ) {
      return;
    }

    blasterCooldown = 0.38;
    blasterRecoilTime = 0.16;
    muzzleFlash.setEnabled(true);
    callbacks.onAudioEvent("weapon-fire");
    const direction =
      directionOverride?.clone().normalize() ?? camera.getForwardRay().direction.normalize();
    const ray = new Ray(camera.position.clone(), direction, 30);
    const hit = scene.pickWithRay(
      ray,
      (mesh) =>
        mesh === verity ||
        mesh.metadata?.blocksVision === true ||
        (typeof mesh.metadata?.bossRelayIndex === "number" &&
          activeBossRelays.has(mesh.metadata.bossRelayIndex)),
      false,
    );
    if (!hit?.hit || !hit.pickedMesh) return;

    const relayIndex = hit.pickedMesh.metadata?.bossRelayIndex;
    if (typeof relayIndex === "number" && activeBossRelays.has(relayIndex)) {
      destroyBossRelay(relayIndex);
      return;
    }
    if (hit.pickedMesh !== verity) return;
    if (bossMode !== "vulnerable") {
      callbacks.onStatusChange("Импульс поглотил щит. Уничтожьте три светящихся реле.");
      return;
    }
    damageBoss();
  }

  function destroyBossRelay(index: number): void {
    if (bossMode !== "shielded" || !activeBossRelays.delete(index)) return;
    bossArena.shieldNodes[index].core.material = bossArena.relayInactiveMaterial;
    bossArena.shieldNodes[index].core.scaling.setAll(0.62);
    callbacks.onAudioEvent("boss-hit");
    const remaining = activeBossRelays.size;
    callbacks.onObjectiveChange(
      remaining > 0
        ? `Фаза ${bossPhase}/3: уничтожьте реле щита — осталось ${remaining}.`
        : `Фаза ${bossPhase}/3: щит разрушен. Огонь по Верити!`,
    );
    callbacks.onStatusChange(
      remaining > 0 ? `Реле уничтожено. Осталось: ${remaining}.` : "Щит рухнул — окно уязвимости открыто!",
    );
    if (remaining === 0) beginBossVulnerability();
  }

  function damageBoss(): void {
    bossHealth = Math.max(0, bossHealth - 1);
    bossDamageThisWindow += 1;
    bossStunTime = 0.18;
    callbacks.onAudioEvent(bossHealth === 0 ? "boss-defeat" : "boss-hit");
    callbacks.onBossHealthChange(bossHealth, BOSS_MAX_HEALTH, true);

    if (bossHealth === 0) {
      bossMode = "defeated";
      levelCompleted = true;
      escaped = true;
      clearBossProjectiles();
      bossArena.shieldMesh.setEnabled(false);
      bossArena.chargeMarker.setEnabled(false);
      verity.setEnabled(false);
      updateHeldBlasterVisibility();
      callbacks.onPromptChange(null);
      callbacks.onObjectiveChange("Верити побеждён. Вы выбрались из лиминального комплекса.");
      callbacks.onStatusChange("Финальная цель уничтожена. Игра пройдена!");
      emitProgress();
      return;
    }

    callbacks.onObjectiveChange(
      `Фаза ${bossPhase}/3: Верити уязвим ${Math.ceil(bossVulnerabilityTime)} сек. Прочность ${bossHealth}/${BOSS_MAX_HEALTH}.`,
    );
    const hitsRequired = bossPhase === 3 ? 2 : 3;
    if (bossDamageThisWindow >= hitsRequired) {
      bossPhase = Math.min(3, bossPhase + 1);
      beginBossShieldPhase(true);
    } else {
      callbacks.onStatusChange(`Попадание ${bossDamageThisWindow}/${hitsRequired} в текущей фазе.`);
    }
    emitProgress();
  }

  function beginBossShieldPhase(announce: boolean): void {
    bossMode = "shielded";
    bossVulnerabilityTime = 0;
    bossDamageThisWindow = 0;
    bossAttackCooldown = Math.max(0.9, 2.25 - bossPhase * 0.28);
    bossChargeCooldown = bossPhase === 1 ? Number.POSITIVE_INFINITY : 5.8 - bossPhase * 0.75;
    bossChargeWindup = 0;
    bossChargeTime = 0;
    bossArena.chargeMarker.setEnabled(false);
    clearBossProjectiles();
    activeBossRelays.clear();
    const relayIndices = BOSS_RELAY_PHASES[bossPhase - 1];
    bossArena.shieldNodes.forEach(({ core }, index) => {
      const active = relayIndices.includes(index);
      core.material = active ? bossArena.relayActiveMaterial : bossArena.relayInactiveMaterial;
      core.scaling.setAll(active ? 1 : 0.62);
      if (active) activeBossRelays.add(index);
    });
    bossArena.shieldMesh.setEnabled(true);
    activeVerityFace = "chase";
    verityFace.material = chaseFaceMaterial;
    callbacks.onObjectiveChange(`Фаза ${bossPhase}/3: уничтожьте три светящихся реле щита.`);
    if (announce) {
      callbacks.onStatusChange(
        bossPhase === 3
          ? "Последняя фаза: Верити выпускает тройные залпы и чаще идёт на таран."
          : `Щит восстановлен. Началась фаза ${bossPhase}/3.`,
      );
    }
  }

  function beginBossVulnerability(): void {
    bossMode = "vulnerable";
    bossVulnerabilityTime = BOSS_VULNERABILITY_SECONDS;
    bossDamageThisWindow = 0;
    bossChargeWindup = 0;
    bossChargeTime = 0;
    bossArena.chargeMarker.setEnabled(false);
    bossArena.shieldMesh.setEnabled(false);
    clearBossProjectiles();
    callbacks.onObjectiveChange(
      `Фаза ${bossPhase}/3: Верити уязвим ${BOSS_VULNERABILITY_SECONDS} сек. Стреляйте!`,
    );
  }

  function startBossFight(announce: boolean): void {
    bossPhase = bossPhaseForHealth(bossHealth);
    bossOrbitAngle = Math.atan2(verity.position.z, verity.position.x - 190);
    beginBossShieldPhase(announce);
  }

  function setBossDormant(): void {
    bossMode = "dormant";
    activeBossRelays.clear();
    bossArena.shieldNodes.forEach(({ core }) => {
      core.material = bossArena.relayInactiveMaterial;
      core.scaling.setAll(0.62);
    });
    bossArena.shieldMesh.setEnabled(false);
    bossArena.chargeMarker.setEnabled(false);
    clearBossProjectiles();
  }

  function updateBossFight(deltaSeconds: number): void {
    updateBossProjectiles(deltaSeconds);
    if (bossMode === "dormant" || bossMode === "defeated") return;

    if (bossMode === "vulnerable") {
      bossVulnerabilityTime = Math.max(0, bossVulnerabilityTime - deltaSeconds);
      verity.rotation.y += deltaSeconds * 0.8;
      if (bossVulnerabilityTime === 0) {
        callbacks.onStatusChange("Окно закрылось — щит Верити восстановлен.");
        beginBossShieldPhase(false);
      }
      return;
    }

    bossArena.shieldMesh.scaling.setAll(1 + Math.sin(performance.now() / 105) * 0.045);
    bossAttackCooldown -= deltaSeconds;
    if (bossAttackCooldown <= 0) {
      launchBossVolley(camera.position);
      bossAttackCooldown = Math.max(0.8, 2.25 - bossPhase * 0.3);
    }

    if (bossPhase >= 2 && bossChargeWindup === 0 && bossChargeTime === 0) {
      bossChargeCooldown -= deltaSeconds;
      if (bossChargeCooldown <= 0) {
        bossChargeWindup = 0.9;
        bossArena.chargeMarker.position.set(camera.position.x, 0.08, camera.position.z);
        bossArena.chargeMarker.scaling.setAll(1);
        bossArena.chargeMarker.setEnabled(true);
        callbacks.onStatusChange("Красный круг — цель рывка! Уходите за колонну.");
      }
    }

    if (bossChargeWindup > 0) {
      bossChargeWindup = Math.max(0, bossChargeWindup - deltaSeconds);
      const pulse = 1 + Math.sin(performance.now() / 65) * 0.18;
      bossArena.chargeMarker.scaling.setAll(pulse);
      if (bossChargeWindup === 0) {
        bossChargeDirection.copyFrom(bossArena.chargeMarker.position.subtract(verity.position));
        bossChargeDirection.y = 0;
        if (bossChargeDirection.lengthSquared() > 0.01) bossChargeDirection.normalize();
        bossChargeTime = 0.85;
        bossArena.chargeMarker.setEnabled(false);
      }
      faceBossTowards(camera.position, deltaSeconds);
      return;
    }

    if (bossChargeTime > 0) {
      bossChargeTime = Math.max(0, bossChargeTime - deltaSeconds);
      verity.moveWithCollisions(bossChargeDirection.scale((9.5 + bossPhase) * deltaSeconds));
      faceBossTowards(camera.position, deltaSeconds);
      if (horizontalDistance(verity.position, camera.position) < 1.3) {
        clearBossProjectiles();
        handleCaught();
        return;
      }
      if (bossChargeTime === 0) bossChargeCooldown = 5.6 - bossPhase * 0.7;
      return;
    }

    bossOrbitAngle += deltaSeconds * (0.33 + bossPhase * 0.08);
    const orbitTarget = new Vector3(
      190 + Math.cos(bossOrbitAngle) * 12,
      1.4,
      Math.sin(bossOrbitAngle) * 11.5,
    );
    const orbitDirection = orbitTarget.subtract(verity.position);
    orbitDirection.y = 0;
    if (orbitDirection.lengthSquared() > 0.02) {
      orbitDirection.normalize();
      verity.moveWithCollisions(orbitDirection.scale((2.15 + bossPhase * 0.32) * deltaSeconds));
    }
    faceBossTowards(camera.position, deltaSeconds);
    if (horizontalDistance(verity.position, camera.position) < 1.3) {
      clearBossProjectiles();
      handleCaught();
    }
  }

  function launchBossVolley(playerPosition: Vector3): void {
    const count = bossPhase;
    const baseDirection = playerPosition.subtract(verity.position);
    baseDirection.y = 0.12;
    if (baseDirection.lengthSquared() < 0.01) return;
    baseDirection.normalize();
    for (let index = 0; index < count; index += 1) {
      const spread = (index - (count - 1) / 2) * 0.18;
      const cosine = Math.cos(spread);
      const sine = Math.sin(spread);
      const direction = new Vector3(
        baseDirection.x * cosine - baseDirection.z * sine,
        baseDirection.y,
        baseDirection.x * sine + baseDirection.z * cosine,
      ).normalize();
      const projectile = MeshBuilder.CreateSphere(
        `boss-projectile-${performance.now()}-${index}`,
        { diameter: 0.46, segments: 8 },
        scene,
      );
      projectile.position.copyFrom(verity.position.add(direction.scale(1.15)));
      projectile.material = bossArena.projectileMaterial;
      projectile.isPickable = false;
      bossProjectiles.push({
        mesh: projectile,
        velocity: direction.scale(5.2 + bossPhase * 0.85),
        remaining: 5,
      });
    }
    callbacks.onAudioEvent("verity-alert");
  }

  function updateBossProjectiles(deltaSeconds: number): void {
    for (let index = bossProjectiles.length - 1; index >= 0; index -= 1) {
      const projectile = bossProjectiles[index];
      projectile.remaining -= deltaSeconds;
      const movement = projectile.velocity.scale(deltaSeconds);
      const wallHit = scene.pickWithRay(
        new Ray(projectile.mesh.position.clone(), movement.normalizeToNew(), movement.length() + 0.16),
        (mesh) => mesh.metadata?.blocksVision === true,
        false,
      );
      if (wallHit?.hit || projectile.remaining <= 0) {
        projectile.mesh.dispose();
        bossProjectiles.splice(index, 1);
        continue;
      }
      projectile.mesh.position.addInPlace(movement);
      if (Vector3.Distance(projectile.mesh.position, camera.position) < 0.72) {
        clearBossProjectiles();
        handleCaught();
        return;
      }
    }
  }

  function clearBossProjectiles(): void {
    bossProjectiles.forEach(({ mesh }) => mesh.dispose());
    bossProjectiles.length = 0;
  }

  function faceBossTowards(target: Vector3, deltaSeconds: number): void {
    const direction = target.subtract(verity.position);
    const targetYaw = Math.atan2(direction.x, direction.z);
    verity.rotation.y = smoothAngle(verity.rotation.y, targetYaw, Math.min(1, deltaSeconds * 6));
  }

  function playPickaxeSwing(): void {
    pickaxeSwingTime = 0.34;
  }

  function spawnAnchorFragments(position: Vector3): void {
    for (let index = 0; index < 8; index += 1) {
      const fragment = MeshBuilder.CreateBox(
        `mine-anchor-fragment-${performance.now()}-${index}`,
        { size: 0.16 + (index % 3) * 0.06 },
        scene,
      );
      fragment.position.copyFrom(position.add(new Vector3(0, 0.25, 0)));
      fragment.material = blockMine.anchorActiveMaterial;
      fragment.isPickable = false;
      const angle = (index / 8) * Math.PI * 2;
      anchorFragments.push({
        mesh: fragment,
        velocity: new Vector3(Math.cos(angle) * 2.2, 1.5 + (index % 3) * 0.45, Math.sin(angle) * 2.2),
        remaining: 0.8,
      });
    }
  }

  function clearAnchorFragments(): void {
    anchorFragments.forEach(({ mesh }) => mesh.dispose());
    anchorFragments.length = 0;
  }

  function updateMinePortalState(): void {
    const open = destroyedMineAnchorIds.size === MINE_ANCHOR_IDS.length;
    blockMine.exitPortal.material = open
      ? blockMine.portalOpenMaterial
      : blockMine.portalLockedMaterial;
    blockMine.portalLight.intensity = open ? 0.48 : 0.08;
    blockMine.exitPortal.scaling.y = open ? 1 : 0.86;
  }

  function updateLabExitState(): void {
    const ready = activatedLabTerminalIds.size === LAB_TERMINAL_IDS.length;
    observationLab.exitDoor.material = ready
      ? observationLab.exitReadyMaterial
      : observationLab.exitLockedMaterial;
    observationLab.exitLight.intensity = ready ? 0.28 : 0;
  }

  function toggleFlashlightState(): void {
    if (flashlightCharge <= 0) {
      callbacks.onStatusChange("Фонарь разряжен. Найдите батарею.");
      return;
    }
    flashlightUserEnabled = !flashlightUserEnabled;
    updateFlashlight();
    callbacks.onFlashlightChange(flashlightCharge, flashlightIsActive());
    callbacks.onAudioEvent("flashlight");
  }

  function enterHideSpot(spot: HideSpot): void {
    playerHidden = true;
    activeHideSpot = spot;
    camera.detachControl();
    camera.position.copyFrom(spot.hidePosition);
    camera.rotation.set(0, 0, 0);
    lastPlayerPosition.copyFrom(camera.position);
    updateFlashlight();
    callbacks.onFlashlightChange(flashlightCharge, false);
    callbacks.onAudioEvent("hide");
    callbacks.onStatusChange("Вы спрятались. Верити не видит и не слышит вас.");
  }

  function leaveHideSpot(): void {
    if (!activeHideSpot) return;
    camera.position.copyFrom(activeHideSpot.exitPosition);
    lastPlayerPosition.copyFrom(camera.position);
    activeHideSpot = null;
    playerHidden = false;
    if (!options.mobileControls) camera.attachControl(canvas, true);
    updateFlashlight();
    callbacks.onFlashlightChange(flashlightCharge, flashlightIsActive());
    callbacks.onAudioEvent("hide");
    callbacks.onStatusChange("Вы покинули укрытие.");
  }

  function addInventoryItem(itemId: string): void {
    if (inventoryItemIds.has(itemId)) return;
    inventoryItemIds.add(itemId);
    callbacks.onInventoryChange([...inventoryItemIds]);
  }

  const interactionSystem = new InteractionSystem();
  interactionSystem.register({
    id: "exit-key",
    position: () => key.position,
    isAvailable: () => !hasKey && key.isEnabled(),
    prompt: () => "E — взять ключ",
    interact: () => {
      hasKey = true;
      addInventoryItem(EXIT_KEY_ITEM_ID);
      key.setEnabled(false);
      activeVerityController.wake();
      callbacks.onAudioEvent("key");
      emitProgress();
      callbacks.onObjectiveChange("Ключ найден. Доберитесь до служебной двери.");
      callbacks.onStatusChange("Верити услышал звон ключа и начал охоту.");
    },
  });
  interactionSystem.register({
    id: "note-01",
    position: () => note.position,
    isAvailable: () => !noteRead && note.isEnabled(),
    prompt: () => "E — прочитать записку",
    interact: () => {
      noteRead = true;
      note.setEnabled(false);
      callbacks.onAudioEvent("note");
      emitProgress();
      callbacks.onNoteOpen(NOTE_01.title, NOTE_01.body);
    },
  });
  interactionSystem.register({
    id: "exit-door",
    position: () => door.position,
    isAvailable: () => currentZone === "yellow-rooms",
    prompt: () => (hasKey ? "E — открыть служебную дверь" : "E — проверить дверь"),
    interact: () => {
      if (!hasKey) {
        callbacks.onStatusChange("Служебная дверь заперта. Нужен ключ.");
        return;
      }
      enterPipeDreams();
    },
  });
  interactionSystem.register({
    id: "flashlight-battery",
    position: () => battery.position,
    isAvailable: () => !batteryCollected && battery.isEnabled(),
    prompt: () => "E — взять батарею",
    interact: () => {
      batteryCollected = true;
      battery.setEnabled(false);
      flashlightCharge = Math.min(100, flashlightCharge + 45);
      flashlightUserEnabled = true;
      reportedChargePercent = Math.ceil(flashlightCharge);
      savedChargeBucket = Math.floor(flashlightCharge / 5);
      updateFlashlight();
      callbacks.onFlashlightChange(flashlightCharge, flashlightIsActive());
      callbacks.onAudioEvent("battery");
      callbacks.onStatusChange("Найдена батарея. Заряд фонаря восстановлен.");
      emitProgress();
    },
  });
  pipeValves.forEach((valve, index) => {
    const { id, mesh } = valve;
    interactionSystem.register({
      id,
      position: () => mesh.position,
      isAvailable: () => currentZone === "pipe-dreams" && !activatedValveIds.has(id),
      prompt: () => `E — повернуть вентиль ${index + 1}`,
      interact: () => {
        activatedValveIds.add(id);
        setPipeValveState(valve, true);
        callbacks.onAudioEvent("anchor-break");
        emitProgress();
        const count = activatedValveIds.size;
        callbacks.onObjectiveChange(
          initialObjective(
            currentZone,
            hasKey,
            noteRead,
            levelCompleted,
            count,
            destroyedMineAnchorIds.size,
            hasMinePickaxe,
          ),
        );
        callbacks.onStatusChange(
          count === PIPE_VALVE_IDS.length
            ? "Давление сброшено. Аварийный выход разблокирован."
            : `Вентиль перекрыт. Осталось: ${PIPE_VALVE_IDS.length - count}.`,
        );
      },
    });
  });
  interactionSystem.register({
    id: "pipe-exit",
    position: () => pipeExitDoor.position,
    isAvailable: () => currentZone === "pipe-dreams" && !levelCompleted,
    prompt: () =>
      activatedValveIds.size === PIPE_VALVE_IDS.length
        ? "E — открыть аварийный выход"
        : "E — проверить аварийный выход",
    interact: () => {
      if (activatedValveIds.size < PIPE_VALVE_IDS.length) {
        callbacks.onStatusChange(
          `Дверь заблокирована давлением. Перекрыто вентилей: ${activatedValveIds.size}/${PIPE_VALVE_IDS.length}.`,
        );
        return;
      }
      pipeExitDoor.position.y = -2;
      pipeExitDoor.checkCollisions = false;
      pipeExitDoor.metadata.blocksVision = false;
      enterBlockMines();
    },
  });
  interactionSystem.register({
    id: "mine-pickaxe",
    position: () => blockMine.pickaxePosition,
    isAvailable: () => currentZone === "block-mines" && !hasMinePickaxe,
    prompt: () => "E — взять железную кирку",
    interact: () => {
      hasMinePickaxe = true;
      addInventoryItem(MINE_PICKAXE_ITEM_ID);
      blockMine.pickaxeMeshes.forEach((mesh) => mesh.setEnabled(false));
      updateHeldPickaxeVisibility();
      callbacks.onAudioEvent("key");
      callbacks.onObjectiveChange(
        initialObjective(
          currentZone,
          hasKey,
          noteRead,
          levelCompleted,
          activatedValveIds.size,
          destroyedMineAnchorIds.size,
          hasMinePickaxe,
        ),
      );
      callbacks.onStatusChange("Кирка найдена. Разбейте три жёлтых якоря Верити.");
      emitProgress();
    },
  });
  blockMine.anchors.forEach(({ id, mesh }, index) => {
    interactionSystem.register({
      id,
      position: () => mesh.position,
      isAvailable: () => currentZone === "block-mines" && !destroyedMineAnchorIds.has(id),
      prompt: () => (hasMinePickaxe ? `E — разбить якорь ${index + 1}` : "Нужна кирка"),
      interact: () => {
        if (!hasMinePickaxe) {
          callbacks.onStatusChange("Кристалл слишком прочный. Найдите кирку в шахтёрском лагере.");
          return;
        }
        destroyedMineAnchorIds.add(id);
        playPickaxeSwing();
        spawnAnchorFragments(mesh.position);
        mesh.material = blockMine.anchorDestroyedMaterial;
        mesh.scaling.setAll(0.45);
        mineVerityController.setAggression(destroyedMineAnchorIds.size);
        updateMinePortalState();
        callbacks.onAudioEvent("valve");
        const count = destroyedMineAnchorIds.size;
        callbacks.onObjectiveChange(
          initialObjective(
            currentZone,
            hasKey,
            noteRead,
            levelCompleted,
            activatedValveIds.size,
            count,
            hasMinePickaxe,
          ),
        );
        callbacks.onStatusChange(
          count === MINE_ANCHOR_IDS.length
            ? "Все якоря разрушены. Фиолетовый портал разблокирован."
            : `Якорь разрушен. Осталось: ${MINE_ANCHOR_IDS.length - count}. Верити ускорился.`,
        );
        emitProgress();
      },
    });
  });
  [
    { id: NOTE_02_ID, note: NOTE_02, mesh: blockMine.noteMeshes[0], read: () => mineNoteOneRead, mark: () => { mineNoteOneRead = true; } },
    { id: NOTE_03_ID, note: NOTE_03, mesh: blockMine.noteMeshes[1], read: () => mineNoteTwoRead, mark: () => { mineNoteTwoRead = true; } },
  ].forEach((entry) => {
    interactionSystem.register({
      id: entry.id,
      position: () => entry.mesh.position,
      isAvailable: () => currentZone === "block-mines" && !entry.read() && entry.mesh.isEnabled(),
      prompt: () => "E — прочитать записку",
      interact: () => {
        entry.mark();
        entry.mesh.setEnabled(false);
        callbacks.onAudioEvent("note");
        emitProgress();
        callbacks.onNoteOpen(entry.note.title, entry.note.body);
      },
    });
  });
  interactionSystem.register({
    id: "mine-exit",
    position: () => blockMine.exitPortal.position,
    isAvailable: () => currentZone === "block-mines" && !levelCompleted,
    prompt: () =>
      destroyedMineAnchorIds.size === MINE_ANCHOR_IDS.length
        ? "E — войти в портал"
        : "E — проверить портал",
    interact: () => {
      if (destroyedMineAnchorIds.size < MINE_ANCHOR_IDS.length) {
        callbacks.onStatusChange(
          `Портал удерживают якоря: ${destroyedMineAnchorIds.size}/${MINE_ANCHOR_IDS.length}.`,
        );
        return;
      }
      blockMine.exitPortal.position.y = -2;
      blockMine.exitPortal.checkCollisions = false;
      blockMine.exitPortal.metadata.blocksVision = false;
      enterObservationLab();
    },
  });
  observationLab.terminals.forEach(({ id, mesh, screen }, index) => {
    interactionSystem.register({
      id,
      position: () => mesh.position,
      isAvailable: () => currentZone === "observation-lab" && !activatedLabTerminalIds.has(id),
      prompt: () => `E — запустить контур ${index + 1}`,
      interact: () => {
        activatedLabTerminalIds.add(id);
        screen.material = observationLab.terminalActiveMaterial;
        labVerityController.setAggression(activatedLabTerminalIds.size);
        updateLabExitState();
        callbacks.onAudioEvent("terminal");
        const count = activatedLabTerminalIds.size;
        callbacks.onObjectiveChange(
          initialObjective(
            currentZone,
            hasKey,
            noteRead,
            levelCompleted,
            activatedValveIds.size,
            destroyedMineAnchorIds.size,
            hasMinePickaxe,
            count,
          ),
        );
        callbacks.onStatusChange(
          count === LAB_TERMINAL_IDS.length
            ? "Питание восстановлено. Лифт разблокирован."
            : `Контур запущен. Осталось: ${LAB_TERMINAL_IDS.length - count}. Верити ускорился.`,
        );
        emitProgress();
      },
    });
  });
  interactionSystem.register({
    id: NOTE_04_ID,
    position: () => observationLab.notePosition,
    isAvailable: () => currentZone === "observation-lab" && !labNoteRead && observationLab.noteMesh.isEnabled(),
    prompt: () => "E — прочитать протокол",
    interact: () => {
      labNoteRead = true;
      observationLab.noteMesh.setEnabled(false);
      callbacks.onAudioEvent("note");
      emitProgress();
      callbacks.onNoteOpen(NOTE_04.title, NOTE_04.body);
    },
  });
  interactionSystem.register({
    id: "lab-exit",
    position: () => observationLab.exitDoor.position,
    isAvailable: () => currentZone === "observation-lab" && !levelCompleted,
    prompt: () =>
      activatedLabTerminalIds.size === LAB_TERMINAL_IDS.length
        ? "E — вызвать лифт"
        : "E — проверить лифт",
    interact: () => {
      if (activatedLabTerminalIds.size < LAB_TERMINAL_IDS.length) {
        callbacks.onStatusChange(
          `Лифт обесточен. Запущено контуров: ${activatedLabTerminalIds.size}/${LAB_TERMINAL_IDS.length}.`,
        );
        return;
      }
      observationLab.exitDoor.position.y = -2;
      observationLab.exitDoor.checkCollisions = false;
      observationLab.exitDoor.metadata.blocksVision = false;
      enterBossArena();
    },
  });
  interactionSystem.register({
    id: "boss-weapon",
    position: () => bossArena.weaponPosition,
    isAvailable: () => currentZone === "boss-arena" && !hasBossWeapon && !levelCompleted,
    prompt: () => "E — взять импульсное ружьё",
    interact: () => {
      hasBossWeapon = true;
      addInventoryItem(BOSS_WEAPON_ITEM_ID);
      bossArena.weaponMeshes.forEach((mesh) => mesh.setEnabled(false));
      updateHeldBlasterVisibility();
      startBossFight(true);
      callbacks.onAudioEvent("key");
      callbacks.onObjectiveChange("Фаза 1/3: уничтожьте три светящихся реле щита.");
      callbacks.onStatusChange("Верити проснулся под щитом. Стреляйте по голубым реле и уклоняйтесь от залпов.");
      emitProgress();
    },
  });
  hideSpots.forEach((spot, index) => {
    interactionSystem.register({
      id: `hide-spot-${index}`,
      position: () => spot.interactionPosition,
      isAvailable: () => !playerHidden,
      prompt: () => "E — спрятаться",
      interact: () => enterHideSpot(spot),
    });
  });
  interactionSystem.register({
    id: "leave-hide-spot",
    position: () => camera.position,
    isAvailable: () => playerHidden,
    prompt: () => "E — выйти из укрытия",
    interact: leaveHideSpot,
    priority: 100,
  });

  scene.onBeforeRenderObservable.add(() => {
    if (!running || escaped || defeated) return;

    const deltaSeconds = engine.getDeltaTime() / 1000;
    if (zoneTransitionTime > 0) {
      zoneTransitionTime = Math.max(0, zoneTransitionTime - deltaSeconds);
      return;
    }
    blasterCooldown = Math.max(0, blasterCooldown - deltaSeconds);
    bossStunTime = Math.max(0, bossStunTime - deltaSeconds);
    if (blasterRecoilTime > 0) {
      blasterRecoilTime = Math.max(0, blasterRecoilTime - deltaSeconds);
      heldBlaster.position.z = 1.05 - Math.sin((blasterRecoilTime / 0.16) * Math.PI) * 0.16;
      if (blasterRecoilTime === 0) muzzleFlash.setEnabled(false);
    } else {
      heldBlaster.position.z = 1.05;
    }
    for (let index = anchorFragments.length - 1; index >= 0; index -= 1) {
      const fragment = anchorFragments[index];
      fragment.remaining -= deltaSeconds;
      fragment.velocity.y -= 4.8 * deltaSeconds;
      fragment.mesh.position.addInPlace(fragment.velocity.scale(deltaSeconds));
      fragment.mesh.rotation.x += deltaSeconds * 5.5;
      fragment.mesh.rotation.z += deltaSeconds * 4.2;
      fragment.mesh.scaling.setAll(Math.max(0.08, fragment.remaining / 0.8));
      if (fragment.remaining <= 0) {
        fragment.mesh.dispose();
        anchorFragments.splice(index, 1);
      }
    }
    steamWarningCooldown = Math.max(0, steamWarningCooldown - deltaSeconds);
    steamJets.forEach((jet) => {
      const cycle = (performance.now() / 1000 + jet.phaseOffset) % 5;
      const active = currentZone === "pipe-dreams" && cycle < 2.15;
      if (active !== jet.active) {
        jet.active = active;
        jet.cloud.setEnabled(active);
        jet.blocker.setEnabled(active);
        jet.blocker.checkCollisions = active;
      }
      if (active) {
        const pulse = 0.92 + Math.sin(performance.now() / 90 + jet.phaseOffset) * 0.08;
        jet.cloud.scaling.y = 1.4 * pulse;
        if (horizontalDistance(camera.position, jet.cloud.position) < 1.8 && steamWarningCooldown === 0) {
          steamWarningCooldown = 1.2;
          callbacks.onStatusChange("Обжигающий пар перекрыл проход. Дождитесь паузы.");
        }
      }
    });
    const keyboardMoveX = Number(pressedMoveKeys.has("KeyD")) - Number(pressedMoveKeys.has("KeyA"));
    const keyboardMoveForward = Number(pressedMoveKeys.has("KeyW")) - Number(pressedMoveKeys.has("KeyS"));
    const moveX = Math.max(-1, Math.min(1, mobileMoveX + keyboardMoveX));
    const moveForward = Math.max(-1, Math.min(1, mobileMoveForward + keyboardMoveForward));
    if (!playerHidden && (Math.abs(moveX) > 0.02 || Math.abs(moveForward) > 0.02)) {
      const forward = camera.getForwardRay().direction;
      forward.y = 0;
      forward.normalize();
      const right = Vector3.Cross(Vector3.Up(), forward).normalize();
      const movement = forward.scale(moveForward).add(right.scale(moveX));
      if (movement.lengthSquared() > 1) movement.normalize();
      camera.cameraDirection.addInPlace(movement.scale(3.3 * deltaSeconds));
    }
    const playerMoveDistance = horizontalDistance(camera.position, lastPlayerPosition);
    const playerMoved = playerMoveDistance > 0.012;
    if (playerMoved) {
      playerStepDistance += playerMoveDistance;
      if (playerStepDistance >= 1.45) {
        playerStepDistance = 0;
        callbacks.onAudioEvent("player-step");
      }
    }
    lastPlayerPosition.copyFrom(camera.position);

    if (
      currentZone === "block-mines" &&
      blockMine.lavaZones.some(
        ({ center, width, depth }) =>
          Math.abs(camera.position.x - center.x) < width / 2 - 0.15 &&
          Math.abs(camera.position.z - center.z) < depth / 2 - 0.15,
      )
    ) {
      handleCaught("lava");
      return;
    }

    if (key.isEnabled()) {
      key.rotation.y += deltaSeconds * 0.8;
      key.rotation.z = -0.12 + Math.sin(performance.now() / 420) * 0.06;
      key.position.y = 1 + Math.sin(performance.now() / 350) * 0.12;
    }

    if (battery.isEnabled()) {
      battery.rotation.y += deltaSeconds * 1.5;
      battery.position.y = 0.75 + Math.sin(performance.now() / 420) * 0.08;
    }

    if (currentZone === "block-mines") {
      blockMine.anchors.forEach(({ id, mesh }, index) => {
        if (destroyedMineAnchorIds.has(id)) return;
        mesh.rotation.y += deltaSeconds * (0.55 + index * 0.12);
        mesh.position.y = 1.05 + Math.sin(performance.now() / 430 + index) * 0.08;
      });
      const portalOpen = destroyedMineAnchorIds.size === MINE_ANCHOR_IDS.length;
      if (portalOpen) {
        const portalPulse = 1 + Math.sin(performance.now() / 180) * 0.035;
        blockMine.exitPortal.scaling.x = portalPulse;
        blockMine.exitPortal.scaling.z = portalPulse;
        blockMine.portalLight.intensity = 0.44 + Math.sin(performance.now() / 160) * 0.08;
      }
      if (pickaxeSwingTime > 0) {
        pickaxeSwingTime = Math.max(0, pickaxeSwingTime - deltaSeconds);
        const swingProgress = 1 - pickaxeSwingTime / 0.34;
        heldPickaxe.rotation.x = 0.15 - Math.sin(swingProgress * Math.PI) * 1.05;
        heldPickaxe.rotation.z = -0.45 + Math.sin(swingProgress * Math.PI) * 0.24;
      } else {
        heldPickaxe.rotation.x = 0.15;
        heldPickaxe.rotation.z = -0.45;
      }
    }

    if (flashlightUserEnabled && !playerHidden && flashlightCharge > 0) {
      flashlightCharge = Math.max(0, flashlightCharge - deltaSeconds * 0.62);
      if (flashlightCharge === 0) flashlightUserEnabled = false;

      const currentPercent = Math.ceil(flashlightCharge);
      if (currentPercent !== reportedChargePercent) {
        reportedChargePercent = currentPercent;
        updateFlashlight();
        callbacks.onFlashlightChange(flashlightCharge, flashlightIsActive());
      }

      const currentBucket = Math.floor(flashlightCharge / 5);
      if (currentBucket !== savedChargeBucket) {
        savedChargeBucket = currentBucket;
        emitProgress();
      }
    }

    const prompt = interactionSystem.promptAt(camera.position);
    if (prompt !== lastPrompt) {
      lastPrompt = prompt;
      callbacks.onPromptChange(prompt);
    }

    if (interactRequested) {
      interactRequested = false;
      if (currentZone === "boss-arena" && hasBossWeapon) shootBlaster();
      else interactionSystem.interactAt(camera.position);
    }

    if (currentZone === "boss-arena") updateBossFight(deltaSeconds);
    else activeVerityController.update(deltaSeconds, camera.position, playerMoved, playerHidden);
  });

  const resize = () => engine.resize();
  const keydown = (event: KeyboardEvent) => {
    if (["KeyW", "KeyA", "KeyS", "KeyD"].includes(event.code)) {
      if (running) pressedMoveKeys.add(event.code);
      event.preventDefault();
    }
    if (event.code === "Escape") callbacks.onEscape();
    if (event.code === "KeyE" && !event.repeat && running) {
      interactRequested = true;
      actionCount += 1;
    }
    if (event.code === "Space" && !event.repeat && running && currentZone === "boss-arena") {
      shootBlaster();
      actionCount += 1;
      event.preventDefault();
    }
    if (event.code === "KeyJ" && !event.repeat && running) callbacks.onJournalOpen();
    if (event.code === "KeyF" && !event.repeat && running) toggleFlashlightState();
  };
  const keyup = (event: KeyboardEvent) => {
    pressedMoveKeys.delete(event.code);
  };
  const clearMoveInput = () => {
    pressedMoveKeys.clear();
    mobileMoveX = 0;
    mobileMoveForward = 0;
  };
  const pointerdown = (event: PointerEvent) => {
    if (event.button !== 0 || !running || currentZone !== "boss-arena") return;
    shootBlaster();
    actionCount += 1;
  };

  window.addEventListener("resize", resize);
  window.addEventListener("keydown", keydown);
  window.addEventListener("keyup", keyup);
  window.addEventListener("blur", clearMoveInput);
  canvas.addEventListener("pointerdown", pointerdown);
  engine.runRenderLoop(() => scene.render());

  return {
    start() {
      running = true;
      if (!options.mobileControls) void canvas.requestPointerLock?.();
      if (currentZone === "boss-arena") emitProgress();
    },
    restart() {
      if (livesRemaining === 0) {
        resetCurrentLevel();
        running = true;
        if (!options.mobileControls) void canvas.requestPointerLock?.();
        return;
      }
      defeated = false;
      running = true;
      if (playerHidden) leaveHideSpot();
      if (currentZone === "boss-arena") {
        bossHealth = BOSS_MAX_HEALTH;
        bossStunTime = 0;
        verity.setEnabled(true);
        bossVerityController.setAggression(0);
        callbacks.onBossHealthChange(bossHealth, BOSS_MAX_HEALTH, true);
      }
      const checkpoint =
        currentZone === "pipe-dreams"
          ? PIPE_PLAYER_START
          : currentZone === "block-mines"
            ? MINE_PLAYER_START
            : currentZone === "observation-lab"
              ? LAB_PLAYER_START
              : currentZone === "boss-arena"
                ? BOSS_PLAYER_START
              : PLAYER_START;
      camera.position.copyFrom(checkpoint);
      camera.rotation.set(0, 0, 0);
      lastPlayerPosition.copyFrom(checkpoint);
      playerStepDistance = 0;
      activeVerityController = controllerForZone(currentZone);
      activeVerityController.reset(
        currentZone === "boss-arena" ? hasBossWeapon : currentZone !== "yellow-rooms" || hasKey,
      );
      if (currentZone === "boss-arena") {
        if (hasBossWeapon) startBossFight(false);
        else setBossDormant();
      }
      updateHeldBlasterVisibility();
      applyZoneAtmosphere();
      callbacks.onObjectiveChange(
        initialObjective(
          currentZone,
          hasKey,
          noteRead,
          levelCompleted,
          activatedValveIds.size,
          destroyedMineAnchorIds.size,
          hasMinePickaxe,
          activatedLabTerminalIds.size,
          bossHealth,
          hasBossWeapon,
        ),
      );
      callbacks.onStatusChange(
        currentZone === "pipe-dreams"
          ? "Возврат к контрольной точке. Верити уже в тоннелях."
          : currentZone === "block-mines"
            ? "Возврат к шахтному входу. Собранные предметы сохранены."
            : currentZone === "observation-lab"
              ? "Возврат ко входу в лабораторию. Активные контуры сохранены."
              : currentZone === "boss-arena"
                ? "Новая попытка. Прочность Верити восстановлена."
              : hasKey
                ? "Верити снова ищет вас."
                : "Попробуйте ещё раз.",
      );
      if (!options.mobileControls) void canvas.requestPointerLock?.();
      if (currentZone === "boss-arena") emitProgress();
    },
    pause() {
      running = false;
      clearMoveInput();
      if (!options.mobileControls) document.exitPointerLock?.();
    },
    setMobileMove(x, forward) {
      mobileMoveX = Math.max(-1, Math.min(1, x));
      mobileMoveForward = Math.max(-1, Math.min(1, forward));
    },
    addMobileLook(yawDelta, pitchDelta) {
      if (!running || playerHidden) return;
      camera.rotation.y += yawDelta;
      camera.rotation.x = Math.max(-1.28, Math.min(1.28, camera.rotation.x + pitchDelta));
    },
    interact() {
      if (running) {
        interactRequested = true;
        actionCount += 1;
      }
    },
    toggleFlashlight() {
      if (running) toggleFlashlightState();
    },
    openJournal() {
      if (running) callbacks.onJournalOpen();
    },
    previewVerityFace(face, view = "front") {
      activeVerityFace = face;
      verityFace.material = face === "normal" ? normalFaceMaterial : chaseFaceMaterial;
      verity.scaling.setAll(1);
      camera.position.copyFrom(
        view === "angle" ? new Vector3(12.2, 1.7, 11.2) : new Vector3(10, 1.7, 12.7),
      );
      camera.setTarget(verity.position);
      lastPlayerPosition.copyFrom(camera.position);
    },
    teleportForQa(target) {
      const positions: Record<typeof target, Vector3> = {
        key: new Vector3(11, 1.7, -8.7),
        note: new Vector3(-11, 1.7, 6.25),
        battery: new Vector3(3, 1.7, 9.25),
        door: new Vector3(0, 1.7, 12.8),
        "valve-1": valvePositions[0].add(new Vector3(0, 0.45, 1.1)),
        "valve-2": valvePositions[1].add(new Vector3(0, 0.45, 1.1)),
        "valve-3": valvePositions[2].add(new Vector3(0, 0.45, 1.1)),
        "pipe-exit": new Vector3(49, 1.7, 12.8),
        "mine-pickaxe": blockMine.pickaxePosition.add(new Vector3(0, 0.65, 1.1)),
        "mine-anchor-1": blockMine.anchors[0].mesh.position.add(new Vector3(0, 0.65, 1.25)),
        "mine-anchor-2": blockMine.anchors[1].mesh.position.add(new Vector3(0, 0.65, 1.25)),
        "mine-anchor-3": blockMine.anchors[2].mesh.position.add(new Vector3(0, 0.65, 1.25)),
        "mine-note-1": blockMine.notePositions[0].add(new Vector3(0, 0.65, 1.15)),
        "mine-note-2": blockMine.notePositions[1].add(new Vector3(0, 0.65, 1.15)),
        "mine-lava": blockMine.lavaZones[0].center.add(new Vector3(0, 1.66, 0)),
        "mine-exit": new Vector3(108.8, 1.7, 18),
        "lab-terminal-1": observationLab.terminals[0].mesh.position.add(new Vector3(0, 0.55, -1.2)),
        "lab-terminal-2": observationLab.terminals[1].mesh.position.add(new Vector3(0, 0.55, -1.2)),
        "lab-terminal-3": observationLab.terminals[2].mesh.position.add(new Vector3(0, 0.55, -1.2)),
        "lab-note": observationLab.notePosition.add(new Vector3(0, 0.65, 1.15)),
        "lab-exit": new Vector3(163.8, 1.7, 12),
        "boss-weapon": bossArena.weaponPosition.add(new Vector3(-1.2, 0.7, 0)),
      };
      camera.position.copyFrom(positions[target]);
      const qaLookTargets: Partial<Record<typeof target, Vector3>> = {
        key: key.position,
        "valve-1": pipeValves[0].mesh.position,
        "valve-2": pipeValves[1].mesh.position,
        "valve-3": pipeValves[2].mesh.position,
        "mine-pickaxe": blockMine.pickaxePosition,
        "mine-anchor-1": blockMine.anchors[0].mesh.position,
        "mine-anchor-2": blockMine.anchors[1].mesh.position,
        "mine-anchor-3": blockMine.anchors[2].mesh.position,
        "mine-note-1": blockMine.notePositions[0],
        "mine-note-2": blockMine.notePositions[1],
        "mine-lava": blockMine.lavaZones[0].center,
        "mine-exit": blockMine.exitPortal.position,
        "lab-terminal-1": observationLab.terminals[0].mesh.position,
        "lab-terminal-2": observationLab.terminals[1].mesh.position,
        "lab-terminal-3": observationLab.terminals[2].mesh.position,
        "lab-note": observationLab.notePosition,
        "lab-exit": observationLab.exitDoor.position,
        "boss-weapon": bossArena.weaponPosition,
      };
      const lookTarget = qaLookTargets[target];
      if (lookTarget) camera.setTarget(lookTarget);
      lastPlayerPosition.copyFrom(camera.position);
    },
    triggerCatchForQa() {
      handleCaught();
    },
    shootForQa() {
      camera.setTarget(verity.position);
      blasterCooldown = 0;
      if (bossMode === "vulnerable") damageBoss();
      else shootBlaster(verity.position.subtract(camera.position));
    },
    destroyBossRelayForQa() {
      const relayIndex = activeBossRelays.values().next().value;
      if (typeof relayIndex === "number") destroyBossRelay(relayIndex);
    },
    prepareBossShotForQa() {
      camera.position.copyFrom(verity.position.add(new Vector3(0, 0.3, -4)));
      camera.setTarget(verity.position);
      lastPlayerPosition.copyFrom(camera.position);
    },
    getDebugState() {
      return {
        running,
        playerHidden,
        player: {
          x: camera.position.x,
          y: camera.position.y,
          z: camera.position.z,
          pitch: camera.rotation.x,
          yaw: camera.rotation.y,
        },
        verity: {
          x: verity.position.x,
          y: verity.position.y,
          z: verity.position.z,
        },
        mobileMove: { x: mobileMoveX, forward: mobileMoveForward },
        flashlight: {
          charge: flashlightCharge,
          enabled: flashlightIsActive(),
          intensity: flashlight.intensity,
        },
        verityFace: activeVerityFace,
        inventoryItemIds: [...inventoryItemIds],
        zone: currentZone,
        activatedValveIds: [...activatedValveIds],
        destroyedMineAnchorIds: [...destroyedMineAnchorIds],
        activatedLabTerminalIds: [...activatedLabTerminalIds],
        completed: levelCompleted,
        livesRemaining,
        yellowRouteSteps: yellowVerityController.debugPathLength(PLAYER_START, key.position),
        mineRouteSteps: [blockMine.pickaxePosition, ...blockMine.anchors.map(({ mesh }) => mesh.position)].map(
          (target) => mineVerityController.debugPathLength(MINE_PLAYER_START, target),
        ),
        labRouteSteps: observationLab.terminals.map(({ mesh }) =>
          labVerityController.debugPathLength(LAB_PLAYER_START, mesh.position),
        ),
        mineAggression: mineVerityController.debugSpeedMultiplier(),
        labAggression: labVerityController.debugSpeedMultiplier(),
        bossHealth,
        hasBossWeapon,
        bossPhase,
        bossMode,
        activeBossRelayCount: activeBossRelays.size,
        bossProjectileCount: bossProjectiles.length,
        heldPickaxeVisible: heldPickaxe.isEnabled(),
        anchorFragmentCount: anchorFragments.length,
        actionCount,
      };
    },
    dispose() {
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", keydown);
      window.removeEventListener("keyup", keyup);
      window.removeEventListener("blur", clearMoveInput);
      canvas.removeEventListener("pointerdown", pointerdown);
      scene.dispose();
      engine.dispose();
    },
  };
}

type HideSpot = {
  interactionPosition: Vector3;
  hidePosition: Vector3;
  exitPosition: Vector3;
};

function currentProgress(
  hasKey: boolean,
  noteRead: boolean,
  completed: boolean,
  flashlightCharge: number,
  batteryCollected: boolean,
  inventoryItemIds: string[],
  zone: LevelOneZone,
  activatedValveIds: string[],
  destroyedMineAnchorIds: string[],
  activatedLabTerminalIds: string[],
  bossHealth: number,
  livesRemaining: number,
  mineNoteOneRead: boolean,
  mineNoteTwoRead: boolean,
  labNoteRead: boolean,
): LevelOneProgress {
  const noteIds = [
    ...(noteRead ? [NOTE_01_ID] : []),
    ...(mineNoteOneRead ? [NOTE_02_ID] : []),
    ...(mineNoteTwoRead ? [NOTE_03_ID] : []),
    ...(labNoteRead ? [NOTE_04_ID] : []),
  ];
  return {
    keyCollected: hasKey,
    noteIds,
    completed,
    flashlightCharge,
    batteryCollected,
    inventoryItemIds,
    zone,
    activatedValveIds,
    destroyedMineAnchorIds,
    activatedLabTerminalIds,
    bossHealth,
    livesRemaining,
  };
}

function initialObjective(
  zone: LevelOneZone,
  hasKey: boolean,
  noteRead: boolean,
  completed: boolean,
  activatedValveCount: number,
  destroyedMineAnchorCount: number,
  hasMinePickaxe: boolean,
  activatedLabTerminalCount = 0,
  bossHealth = BOSS_MAX_HEALTH,
  hasBossWeapon = false,
): string {
  if (completed) return "Верити побеждён. Вы выбрались из лиминального комплекса.";
  if (zone === "boss-arena") {
    if (!hasBossWeapon) return "Возьмите импульсное ружьё с оружейной стойки.";
    return `Фаза ${bossPhaseForHealth(bossHealth)}/3: уничтожьте три светящихся реле щита.`;
  }
  if (zone === "observation-lab") {
    if (activatedLabTerminalCount >= LAB_TERMINAL_IDS.length) {
      return "Питание восстановлено. Доберитесь до лифта.";
    }
    return `Запустите контуры питания: ${activatedLabTerminalCount}/${LAB_TERMINAL_IDS.length}.`;
  }
  if (zone === "block-mines") {
    if (!hasMinePickaxe) return "Обыщите шахтёрский лагерь и найдите кирку.";
    if (destroyedMineAnchorCount >= MINE_ANCHOR_IDS.length) {
      return "Все якоря разрушены. Найдите фиолетовый портал.";
    }
    return `Разбейте якоря Верити: ${destroyedMineAnchorCount}/${MINE_ANCHOR_IDS.length}.`;
  }
  if (zone === "pipe-dreams") {
    if (activatedValveCount >= PIPE_VALVE_IDS.length) return "Давление сброшено. Найдите аварийный выход.";
    return `Перекройте аварийные вентили: ${activatedValveCount}/${PIPE_VALVE_IDS.length}.`;
  }
  if (hasKey) return "Ключ уже у вас. Доберитесь до служебной двери.";
  if (noteRead) return "Записка найдена. Отыщите ключ от выхода.";
  return "Найдите записку и ключ от выхода.";
}

function createLocker(
  scene: Scene,
  id: string,
  basePosition: Vector3,
  lockerMaterial: StandardMaterial,
): HideSpot {
  const pieces = [
    { suffix: "back", width: 1.1, height: 2.5, depth: 0.12, offset: new Vector3(0, 1.25, -0.48) },
    { suffix: "left", width: 0.12, height: 2.5, depth: 1.05, offset: new Vector3(-0.5, 1.25, 0) },
    { suffix: "right", width: 0.12, height: 2.5, depth: 1.05, offset: new Vector3(0.5, 1.25, 0) },
    { suffix: "top", width: 1.1, height: 0.12, depth: 1.05, offset: new Vector3(0, 2.46, 0) },
  ];

  for (const piece of pieces) {
    const mesh = MeshBuilder.CreateBox(
      `${id}-${piece.suffix}`,
      { width: piece.width, height: piece.height, depth: piece.depth },
      scene,
    );
    mesh.position.copyFrom(basePosition.add(piece.offset));
    mesh.material = lockerMaterial;
    mesh.metadata = { blocksVision: true };
  }

  return {
    interactionPosition: basePosition.add(new Vector3(0, 1.2, 0.5)),
    hidePosition: basePosition.add(new Vector3(0, 1.5, 0)),
    exitPosition: basePosition.add(new Vector3(0, 1.5, 1.25)),
  };
}

function verityStateMessage(state: VerityState): string {
  if (state === "patrol") return "Верити бродит по коридорам.";
  if (state === "chase") return "Верити увидел вас — бегите!";
  if (state === "search") return "Верити потерял вас, но проверяет шум.";
  return "Верити пока не двигается.";
}

function horizontalDistance(a: Vector3, b: Vector3): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function bossAggressionStage(health: number): number {
  return Math.max(0, Math.min(3, Math.floor((BOSS_MAX_HEALTH - health) / 2)));
}

function bossPhaseForHealth(health: number): number {
  if (health > 5) return 1;
  if (health > 2) return 2;
  return 3;
}

function smoothAngle(from: number, to: number, amount: number): number {
  const difference = Math.atan2(Math.sin(to - from), Math.cos(to - from));
  return from + difference * amount;
}

function material(
  scene: Scene,
  name: string,
  color: Color3,
  emissive = false,
): StandardMaterial {
  const value = new StandardMaterial(name, scene);
  value.diffuseColor = color;
  value.specularColor = new Color3(0.04, 0.04, 0.04);
  if (emissive) value.emissiveColor = color.scale(0.45);
  return value;
}

function createVerityFaceMaterial(
  scene: Scene,
  name: string,
  textureUrl: string,
): StandardMaterial {
  const faceTexture = new Texture(textureUrl, scene, true, true);
  faceTexture.hasAlpha = true;

  const faceMaterial = new StandardMaterial(`${name}-mat`, scene);
  faceMaterial.diffuseTexture = faceTexture;
  faceMaterial.emissiveTexture = faceTexture;
  faceMaterial.emissiveColor = Color3.White();
  faceMaterial.useAlphaFromDiffuseTexture = true;
  faceMaterial.disableLighting = true;
  faceMaterial.backFaceCulling = false;
  faceMaterial.needDepthPrePass = true;
  faceMaterial.zOffset = -2;
  return faceMaterial;
}

function createVerityFaceDecal(
  parent: Mesh,
  faceMaterial: StandardMaterial,
): Mesh {
  const face = CreateDecal("verity-face", parent, {
    position: new Vector3(0, -0.02, 0.82),
    normal: new Vector3(0, 0, 1),
    size: new Vector3(1.58, 1.58, 0.72),
    cullBackFaces: true,
    localMode: true,
  });
  face.material = faceMaterial;
  face.isPickable = false;
  return face;
}

