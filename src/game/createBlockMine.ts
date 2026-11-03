import { PointLight } from "@babylonjs/core/Lights/pointLight";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { Scene } from "@babylonjs/core/scene";
import { MINE_ANCHOR_IDS } from "./progress";
import type { WallSpec } from "./verityController";
import { createVoxelMaterial } from "./voxelMaterials";

export const MINE_PLAYER_START = new Vector3(70.5, 1.7, -19);
export const MINE_VERITY_START = new Vector3(108, 1.4, 16);
export const MINE_EXIT_POSITION = new Vector3(110.35, 1.75, 18);

export type BlockMineAnchor = {
  id: (typeof MINE_ANCHOR_IDS)[number];
  mesh: Mesh;
};

export type BlockMineScene = {
  wallSpecs: WallSpec[];
  pickaxePosition: Vector3;
  pickaxeMeshes: Mesh[];
  anchors: BlockMineAnchor[];
  anchorActiveMaterial: StandardMaterial;
  anchorDestroyedMaterial: StandardMaterial;
  notePositions: [Vector3, Vector3];
  noteMeshes: [Mesh, Mesh];
  exitPortal: Mesh;
  portalLockedMaterial: StandardMaterial;
  portalOpenMaterial: StandardMaterial;
  portalLight: PointLight;
  lavaZones: Array<{ center: Vector3; width: number; depth: number }>;
};

export function createBlockMine(scene: Scene): BlockMineScene {
  const stone = createVoxelMaterial(
    scene,
    "mine-stone",
    { base: "#4a4b49", light: "#5b5c58", dark: "#30312f", mortar: "#242523" },
    4,
  );
  const deepStone = createVoxelMaterial(
    scene,
    "mine-deep-stone",
    { base: "#292b2d", light: "#3b3d40", dark: "#17191b", mortar: "#111214" },
    4,
  );
  const wood = createVoxelMaterial(
    scene,
    "mine-wood",
    { base: "#6b4427", light: "#875a34", dark: "#3f2819", mortar: "#2d1c12" },
    3,
  );
  const ore = createVoxelMaterial(
    scene,
    "mine-ore",
    { base: "#3e4243", light: "#3d8d8d", dark: "#25292a", mortar: "#16191a" },
    5,
  );
  const iron = solidMaterial(scene, "mine-iron", new Color3(0.35, 0.38, 0.39));
  const rail = solidMaterial(scene, "mine-rail", new Color3(0.22, 0.24, 0.25));
  const lava = solidMaterial(scene, "mine-lava", new Color3(1, 0.18, 0.015), true);
  const torch = solidMaterial(scene, "mine-torch", new Color3(1, 0.48, 0.08), true);
  const portalLockedMaterial = solidMaterial(scene, "mine-portal-locked", new Color3(0.09, 0.045, 0.12));
  portalLockedMaterial.alpha = 0.72;
  const portalOpenMaterial = solidMaterial(scene, "mine-portal-open", new Color3(0.22, 0.03, 0.48), true);
  portalOpenMaterial.alpha = 0.88;
  const anchorActiveMaterial = solidMaterial(scene, "mine-anchor-active", new Color3(0.96, 0.73, 0.03), true);
  const anchorDestroyedMaterial = solidMaterial(scene, "mine-anchor-destroyed", new Color3(0.12, 0.13, 0.12));

  const floor = MeshBuilder.CreateGround("mine-floor", { width: 44, height: 44 }, scene);
  floor.position.x = 90;
  floor.material = deepStone;
  floor.checkCollisions = true;

  const ceiling = MeshBuilder.CreateGround("mine-ceiling", { width: 44, height: 44 }, scene);
  ceiling.position.set(90, 4.8, 0);
  ceiling.rotation.x = Math.PI;
  ceiling.material = stone;

  const wallSpecs: WallSpec[] = [
    [90, -22, 44, 1],
    [90, 22, 44, 1],
    [68, 0, 1, 44],
    [112, 0, 1, 44],
    [80, -8, 1, 22],
    [80, 14, 1, 12],
    [94, 8, 1, 24],
    [104, -11, 1, 18],
  ];
  wallSpecs.forEach(([x, z, width, depth], index) => {
    const wall = MeshBuilder.CreateBox(`mine-wall-${index}`, { width, depth, height: 4.8 }, scene);
    wall.position.set(x, 2.4, z);
    wall.material = index < 4 ? stone : deepStone;
    wall.checkCollisions = true;
    wall.metadata = { blocksVision: true };
  });

  createSupports(scene, wood);
  createRails(scene, rail, wood);
  createOreDeposits(scene, ore);
  const lavaZones = createLavaPools(scene, lava, deepStone);
  createTorches(scene, torch);
  createCamp(scene, wood, iron);

  const pickaxePosition = new Vector3(75, 1.05, 15);
  const pickaxeHandle = MeshBuilder.CreateBox("mine-pickaxe-handle", { width: 0.12, height: 1.3, depth: 0.12 }, scene);
  pickaxeHandle.position.copyFrom(pickaxePosition);
  pickaxeHandle.rotation.z = -0.55;
  pickaxeHandle.material = wood;
  const pickaxeHead = MeshBuilder.CreateBox("mine-pickaxe-head", { width: 0.95, height: 0.16, depth: 0.18 }, scene);
  pickaxeHead.position.copyFrom(pickaxePosition.add(new Vector3(-0.33, 0.48, 0)));
  pickaxeHead.rotation.z = -0.12;
  pickaxeHead.material = iron;

  const anchorPositions = [
    new Vector3(86, 1.05, -15),
    new Vector3(99, 1.05, 15),
    new Vector3(108, 1.05, -10),
  ];
  const anchors = MINE_ANCHOR_IDS.map((id, index) => {
    const mesh = MeshBuilder.CreateBox(id, { size: 1.15 }, scene);
    mesh.position.copyFrom(anchorPositions[index]);
    mesh.rotation.y = index * 0.55;
    mesh.material = anchorActiveMaterial;
    const shardA = MeshBuilder.CreateBox(`${id}-shard-a`, { width: 0.35, height: 1.15, depth: 0.35 }, scene);
    shardA.parent = mesh;
    shardA.position.set(0.48, 0.32, 0.12);
    shardA.rotation.z = 0.5;
    shardA.material = anchorActiveMaterial;
    const shardB = MeshBuilder.CreateBox(`${id}-shard-b`, { width: 0.28, height: 0.9, depth: 0.28 }, scene);
    shardB.parent = mesh;
    shardB.position.set(-0.4, 0.25, -0.22);
    shardB.rotation.z = -0.55;
    shardB.material = anchorActiveMaterial;
    return { id, mesh };
  });

  const noteMaterial = solidMaterial(scene, "mine-note", new Color3(0.82, 0.76, 0.56), true);
  const notePositions: [Vector3, Vector3] = [new Vector3(74, 1.12, 12.8), new Vector3(101, 1.12, -16)];
  const noteMeshes = notePositions.map((position, index) => {
    const note = MeshBuilder.CreateBox(`mine-note-${index + 1}`, { width: 0.72, height: 0.04, depth: 0.5 }, scene);
    note.position.copyFrom(position);
    note.rotation.y = index === 0 ? 0.2 : -0.3;
    note.material = noteMaterial;
    return note;
  }) as [Mesh, Mesh];

  const exitPortal = MeshBuilder.CreateBox("mine-exit-portal", { width: 0.35, height: 3.5, depth: 3 }, scene);
  exitPortal.position.copyFrom(MINE_EXIT_POSITION);
  exitPortal.material = portalLockedMaterial;
  exitPortal.checkCollisions = true;
  exitPortal.metadata = { blocksVision: true };
  const portalLight = new PointLight("mine-portal-light", MINE_EXIT_POSITION.clone(), scene);
  portalLight.diffuse = new Color3(0.6, 0.1, 1);
  portalLight.intensity = 0.08;
  portalLight.range = 8;

  return {
    wallSpecs,
    pickaxePosition,
    pickaxeMeshes: [pickaxeHandle, pickaxeHead],
    anchors,
    anchorActiveMaterial,
    anchorDestroyedMaterial,
    notePositions,
    noteMeshes,
    exitPortal,
    portalLockedMaterial,
    portalOpenMaterial,
    portalLight,
    lavaZones,
  };
}

function createSupports(scene: Scene, material: StandardMaterial): void {
  const supports = [72, 78, 84, 90, 98, 106, 110];
  supports.forEach((x, index) => {
    const z = index % 2 === 0 ? -18 : 18;
    [-2.2, 2.2].forEach((offset, side) => {
      const post = MeshBuilder.CreateBox(`mine-support-${index}-${side}`, { width: 0.32, height: 4, depth: 0.32 }, scene);
      post.position.set(x, 2, z + offset);
      post.material = material;
    });
    const beam = MeshBuilder.CreateBox(`mine-support-beam-${index}`, { width: 0.35, height: 0.35, depth: 4.7 }, scene);
    beam.position.set(x, 3.85, z);
    beam.material = material;
  });
}

function createRails(scene: Scene, railMaterial: StandardMaterial, sleeperMaterial: StandardMaterial): void {
  [-0.58, 0.58].forEach((offset, index) => {
    const rail = MeshBuilder.CreateBox(`mine-rail-${index}`, { width: 38, height: 0.08, depth: 0.1 }, scene);
    rail.position.set(90, 0.07, -18 + offset);
    rail.material = railMaterial;
  });
  for (let x = 71; x <= 109; x += 1.5) {
    const sleeper = MeshBuilder.CreateBox(`mine-sleeper-${x}`, { width: 0.22, height: 0.08, depth: 1.75 }, scene);
    sleeper.position.set(x, 0.05, -18);
    sleeper.material = sleeperMaterial;
  }
}

function createOreDeposits(scene: Scene, material: StandardMaterial): void {
  const positions = [
    [72, -20.8], [76, 20.8], [83, -20.8], [87, 20.8], [91, -20.8],
    [97, 20.8], [102, -20.8], [109, 20.8], [81.2, -5], [93.2, 4], [105.2, -8],
  ];
  positions.forEach(([x, z], index) => {
    const block = MeshBuilder.CreateBox(`mine-ore-${index}`, { size: 1.25 }, scene);
    block.position.set(x, 1.2 + (index % 2) * 1.1, z);
    block.material = material;
  });
}

function createLavaPools(
  scene: Scene,
  material: StandardMaterial,
  rimMaterial: StandardMaterial,
): Array<{ center: Vector3; width: number; depth: number }> {
  const zones = [
    new Vector3(86, 0.04, 6),
    new Vector3(101, 0.04, -6),
  ].map((position, index) => {
    const width = 4.2;
    const depth = 3.2;
    const pool = MeshBuilder.CreateBox(`mine-lava-${index}`, { width: 4.2, height: 0.08, depth: 3.2 }, scene);
    pool.position.copyFrom(position);
    pool.material = material;
    [
      { x: 0, z: -(depth / 2 + 0.18), w: width + 0.7, d: 0.3 },
      { x: 0, z: depth / 2 + 0.18, w: width + 0.7, d: 0.3 },
      { x: -(width / 2 + 0.18), z: 0, w: 0.3, d: depth },
      { x: width / 2 + 0.18, z: 0, w: 0.3, d: depth },
    ].forEach((part, partIndex) => {
      const rim = MeshBuilder.CreateBox(
        `mine-lava-rim-${index}-${partIndex}`,
        { width: part.w, height: 0.22, depth: part.d },
        scene,
      );
      rim.position.set(position.x + part.x, 0.11, position.z + part.z);
      rim.material = rimMaterial;
    });
    return { center: position.clone(), width, depth };
  });
  return zones;
}

function createTorches(scene: Scene, material: StandardMaterial): void {
  const positions = [
    [72, -14], [76, 10], [84, -10], [89, 17], [97, -17], [101, 8], [108, -4], [109, 16],
  ];
  positions.forEach(([x, z], index) => {
    const flame = MeshBuilder.CreateBox(`mine-torch-${index}`, { size: 0.24 }, scene);
    flame.position.set(x, 2.35, z);
    flame.material = material;
    const light = new PointLight(`mine-torch-light-${index}`, flame.position.clone(), scene);
    light.diffuse = new Color3(1, 0.42, 0.09);
    light.intensity = 0.62;
    light.range = 7;
  });
}

function createCamp(scene: Scene, wood: StandardMaterial, iron: StandardMaterial): void {
  const table = MeshBuilder.CreateBox("mine-camp-table", { width: 2.5, height: 0.18, depth: 1.2 }, scene);
  table.position.set(74, 0.92, 13);
  table.material = wood;
  const cart = MeshBuilder.CreateBox("mine-cart", { width: 1.7, height: 0.8, depth: 1.15 }, scene);
  cart.position.set(91, 0.55, -18);
  cart.material = iron;
  [-0.55, 0.55].forEach((offset, index) => {
    const wheel = MeshBuilder.CreateCylinder(`mine-cart-wheel-${index}`, { diameter: 0.42, height: 1.25, tessellation: 12 }, scene);
    wheel.position.set(91 + offset, 0.28, -18);
    wheel.rotation.x = Math.PI / 2;
    wheel.material = iron;
  });
  [
    new Vector3(72.5, 0.5, 15.5),
    new Vector3(76.5, 0.5, 17),
    new Vector3(99, 0.5, -16),
  ].forEach((position, index) => {
    const crate = MeshBuilder.CreateBox(`mine-crate-${index}`, { size: 1 }, scene);
    crate.position.copyFrom(position);
    crate.material = wood;
    crate.checkCollisions = true;
  });
}

function solidMaterial(scene: Scene, name: string, color: Color3, emissive = false): StandardMaterial {
  const result = new StandardMaterial(name, scene);
  result.diffuseColor = color;
  result.specularColor = Color3.Black();
  if (emissive) result.emissiveColor = color.scale(0.72);
  return result;
}
