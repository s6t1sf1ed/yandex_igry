import { PointLight } from "@babylonjs/core/Lights/pointLight";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { Scene } from "@babylonjs/core/scene";
import type { WallSpec } from "./verityController";
import { createVoxelMaterial } from "./voxelMaterials";

export const BOSS_PLAYER_START = new Vector3(177, 1.7, 0);
export const BOSS_VERITY_START = new Vector3(202, 1.4, 0);
export const BOSS_WEAPON_POSITION = new Vector3(179.2, 0.92, 0);
export const BOSS_EXIT_POSITION = new Vector3(204.9, 1.7, 0);
export type BossArenaScene = {
  wallSpecs: WallSpec[];
  weaponMeshes: Mesh[];
  weaponPosition: Vector3;
  arenaLights: PointLight[];
  shieldNodes: Array<{ core: Mesh; position: Vector3 }>;
  relayActiveMaterial: StandardMaterial;
  relayInactiveMaterial: StandardMaterial;
  shieldMesh: Mesh;
  projectileMaterial: StandardMaterial;
  chargeMarker: Mesh;
  exitDoor: Mesh;
  exitSign: Mesh;
  exitStatusBars: Mesh[];
  exitLight: PointLight;
  exitLockedMaterial: StandardMaterial;
  exitOpenMaterial: StandardMaterial;
};

export function createBossArena(scene: Scene): BossArenaScene {
  const floorMaterial = createVoxelMaterial(
    scene,
    "boss-floor",
    { base: "#24282b", light: "#353b3f", dark: "#15191c", mortar: "#090c0e" },
    6,
  );
  const wallMaterial = createVoxelMaterial(
    scene,
    "boss-wall",
    { base: "#4b555b", light: "#67737a", dark: "#2a3135", mortar: "#11171a" },
    4,
  );
  const darkMetal = solid(scene, "boss-dark-metal", new Color3(0.09, 0.115, 0.13));
  const warning = solid(scene, "boss-warning", new Color3(0.9, 0.08, 0.025), true);
  const weaponMetal = solid(scene, "boss-weapon-metal", new Color3(0.3, 0.38, 0.42), true);
  const weaponEnergy = solid(scene, "boss-weapon-energy", new Color3(0.06, 0.72, 1), true);
  const relayInactiveMaterial = solid(scene, "boss-relay-inactive", new Color3(0.04, 0.08, 0.09));
  const relayActiveMaterial = solid(scene, "boss-relay-active", new Color3(0.04, 0.82, 1), true);
  const shieldMaterial = solid(scene, "boss-shield", new Color3(0.04, 0.48, 0.9), true);
  shieldMaterial.alpha = 0.23;
  shieldMaterial.backFaceCulling = false;
  const projectileMaterial = solid(scene, "boss-projectile", new Color3(1, 0.1, 0.025), true);
  const exitDoorMaterial = solid(scene, "boss-exit-door-metal", new Color3(0.055, 0.07, 0.065));
  exitDoorMaterial.emissiveColor = new Color3(0.022, 0.03, 0.027);
  exitDoorMaterial.disableLighting = true;
  const exitLockedMaterial = solid(scene, "boss-exit-locked", new Color3(0.45, 0.035, 0.02), true);
  const exitOpenMaterial = solid(scene, "boss-exit-open", new Color3(0.03, 0.72, 0.31), true);

  const floor = MeshBuilder.CreateGround("boss-floor", { width: 32, height: 30 }, scene);
  floor.position.x = 190;
  floor.material = floorMaterial;
  floor.checkCollisions = true;

  const ceiling = MeshBuilder.CreateGround("boss-ceiling", { width: 32, height: 30 }, scene);
  ceiling.position.set(190, 5.2, 0);
  ceiling.rotation.x = Math.PI;
  ceiling.material = darkMetal;

  const wallSpecs: WallSpec[] = [
    [190, -15, 32, 1],
    [190, 15, 32, 1],
    [174, 0, 1, 30],
    [206, 0, 1, 30],
    [185, -7, 2.4, 2.4],
    [185, 7, 2.4, 2.4],
    [196, -7, 2.4, 2.4],
    [196, 7, 2.4, 2.4],
  ];

  wallSpecs.forEach(([x, z, width, depth], index) => {
    const isCover = index >= 4;
    const mesh = MeshBuilder.CreateBox(
      `boss-wall-${index}`,
      { width, depth, height: isCover ? 3.3 : 5.2 },
      scene,
    );
    mesh.position.set(x, isCover ? 1.65 : 2.6, z);
    mesh.material = isCover ? darkMetal : wallMaterial;
    mesh.checkCollisions = true;
    mesh.metadata = { blocksVision: true };
  });

  const exitDoor = MeshBuilder.CreateBox(
    "boss-exit-door",
    { width: 0.22, height: 3.35, depth: 2.55 },
    scene,
  );
  exitDoor.position.set(205.38, 1.68, 0);
  exitDoor.material = exitDoorMaterial;
  exitDoor.isPickable = false;

  const exitStatusBars = [-0.9, 0.9].map((z, index) => {
    const statusBar = MeshBuilder.CreateBox(
      `boss-exit-status-${index}`,
      { width: 0.08, height: 2.55, depth: 0.13 },
      scene,
    );
    statusBar.position.set(205.23, 1.7, z);
    statusBar.material = exitLockedMaterial;
    return statusBar;
  });

  [-1.48, 1.48].forEach((z, index) => {
    const frame = MeshBuilder.CreateBox(
      `boss-exit-frame-${index}`,
      { width: 0.48, height: 4.15, depth: 0.28 },
      scene,
    );
    frame.position.set(205.12, 2.08, z);
    frame.material = darkMetal;
  });
  const exitLintel = MeshBuilder.CreateBox(
    "boss-exit-lintel",
    { width: 0.48, height: 0.32, depth: 3.25 },
    scene,
  );
  exitLintel.position.set(205.12, 4.02, 0);
  exitLintel.material = darkMetal;

  const exitSign = MeshBuilder.CreateBox(
    "boss-exit-sign",
    { width: 0.12, height: 0.34, depth: 1.25 },
    scene,
  );
  exitSign.position.set(204.84, 4.32, 0);
  exitSign.material = exitLockedMaterial;
  const exitLight = new PointLight("boss-exit-light", new Vector3(203.9, 3.45, 0), scene);
  exitLight.diffuse = new Color3(1, 0.05, 0.02);
  exitLight.intensity = 0.32;
  exitLight.range = 5.5;

  const weaponBase = MeshBuilder.CreateBox(
    "boss-weapon-base",
    { width: 1.15, height: 0.32, depth: 0.34 },
    scene,
  );
  weaponBase.position.copyFrom(BOSS_WEAPON_POSITION);
  weaponBase.rotation.z = -0.18;
  weaponBase.material = weaponMetal;
  const weaponBarrel = MeshBuilder.CreateBox(
    "boss-weapon-barrel",
    { width: 0.82, height: 0.16, depth: 0.18 },
    scene,
  );
  weaponBarrel.position.copyFrom(BOSS_WEAPON_POSITION.add(new Vector3(0.72, 0.12, 0)));
  weaponBarrel.material = weaponEnergy;

  const arenaLights: PointLight[] = [];
  [180, 188, 196, 204].forEach((x, index) => {
    const lamp = MeshBuilder.CreateBox(
      `boss-lamp-${index}`,
      { width: 1.15, height: 0.16, depth: 0.35 },
      scene,
    );
    lamp.position.set(x, 4.65, index % 2 === 0 ? -10 : 10);
    lamp.material = warning;
    const point = new PointLight(
      `boss-light-${index}`,
      lamp.position.add(new Vector3(0, -0.35, 0)),
      scene,
    );
    point.diffuse = index % 2 === 0 ? new Color3(1, 0.08, 0.025) : new Color3(0.06, 0.55, 1);
    point.intensity = 0.62;
    point.range = 10;
    arenaLights.push(point);
  });

  const relayPositions = [
    new Vector3(181, 1.25, -11.5),
    new Vector3(190, 1.25, 11.5),
    new Vector3(201, 1.25, -11.5),
    new Vector3(181, 1.25, 11.5),
    new Vector3(190, 1.25, -11.5),
    new Vector3(201, 1.25, 11.5),
  ];
  const shieldNodes = relayPositions.map((position, index) => {
    const pedestal = MeshBuilder.CreateCylinder(
      `boss-relay-pedestal-${index}`,
      { diameter: 0.82, height: 1.35, tessellation: 8 },
      scene,
    );
    pedestal.position.copyFrom(position.add(new Vector3(0, -0.52, 0)));
    pedestal.material = darkMetal;
    const core = MeshBuilder.CreateSphere(
      `boss-relay-core-${index}`,
      { diameter: 0.66, segments: 12 },
      scene,
    );
    core.position.copyFrom(position);
    core.material = relayInactiveMaterial;
    core.metadata = { bossRelayIndex: index };
    return { core, position: position.clone() };
  });

  const shieldMesh = MeshBuilder.CreateSphere(
    "boss-shield",
    { diameter: 2.45, segments: 20 },
    scene,
  );
  shieldMesh.material = shieldMaterial;
  shieldMesh.isPickable = false;
  shieldMesh.setEnabled(false);

  const chargeMarker = MeshBuilder.CreateTorus(
    "boss-charge-marker",
    { diameter: 2.2, thickness: 0.12, tessellation: 28 },
    scene,
  );
  chargeMarker.rotation.x = Math.PI / 2;
  chargeMarker.position.y = 0.08;
  chargeMarker.material = warning;
  chargeMarker.isPickable = false;
  chargeMarker.setEnabled(false);

  return {
    wallSpecs,
    weaponMeshes: [weaponBase, weaponBarrel],
    weaponPosition: BOSS_WEAPON_POSITION.clone(),
    arenaLights,
    shieldNodes,
    relayActiveMaterial,
    relayInactiveMaterial,
    shieldMesh,
    projectileMaterial,
    chargeMarker,
    exitDoor,
    exitSign,
    exitStatusBars,
    exitLight,
    exitLockedMaterial,
    exitOpenMaterial,
  };
}

function solid(scene: Scene, name: string, color: Color3, emissive = false): StandardMaterial {
  const result = new StandardMaterial(name, scene);
  result.diffuseColor = color;
  result.specularColor = Color3.Black();
  if (emissive) result.emissiveColor = color.scale(0.65);
  return result;
}
