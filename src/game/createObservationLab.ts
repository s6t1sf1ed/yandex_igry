import { PointLight } from "@babylonjs/core/Lights/pointLight";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { Scene } from "@babylonjs/core/scene";
import { LAB_TERMINAL_IDS } from "./progress";
import type { WallSpec } from "./verityController";
import { createVoxelMaterial } from "./voxelMaterials";

export const LAB_PLAYER_START = new Vector3(126, 1.7, -14);
export const LAB_VERITY_START = new Vector3(145, 1.4, 0);
export const LAB_EXIT_POSITION = new Vector3(165.35, 1.75, 12);

export type ObservationLabScene = {
  wallSpecs: WallSpec[];
  terminals: Array<{ id: (typeof LAB_TERMINAL_IDS)[number]; mesh: Mesh; screen: Mesh }>;
  terminalInactiveMaterial: StandardMaterial;
  terminalActiveMaterial: StandardMaterial;
  notePosition: Vector3;
  noteMesh: Mesh;
  exitDoor: Mesh;
  exitLockedMaterial: StandardMaterial;
  exitReadyMaterial: StandardMaterial;
  exitLight: PointLight;
};

export function createObservationLab(scene: Scene): ObservationLabScene {
  const floorMaterial = createVoxelMaterial(
    scene,
    "lab-floor",
    { base: "#30363a", light: "#41494e", dark: "#1d2327", mortar: "#111619" },
    5,
  );
  const wallMaterial = createVoxelMaterial(
    scene,
    "lab-wall",
    { base: "#8a9293", light: "#abb1b0", dark: "#555e60", mortar: "#353d40" },
    4,
  );
  const darkMetal = solid(scene, "lab-dark-metal", new Color3(0.12, 0.15, 0.17));
  const deskMaterial = solid(scene, "lab-desk", new Color3(0.23, 0.26, 0.27));
  const screenOff = solid(scene, "lab-screen-off", new Color3(0.025, 0.055, 0.06), true);
  const screenOn = solid(scene, "lab-screen-on", new Color3(0.04, 0.72, 0.52), true);
  const warning = solid(scene, "lab-warning", new Color3(0.82, 0.055, 0.025), true);
  const glass = solid(scene, "lab-glass", new Color3(0.15, 0.48, 0.52), true);
  glass.alpha = 0.24;
  const exitLockedMaterial = solid(scene, "lab-exit-locked", new Color3(0.22, 0.06, 0.04));
  const exitReadyMaterial = solid(scene, "lab-exit-ready", new Color3(0.035, 0.16, 0.08));

  const floor = MeshBuilder.CreateGround("lab-floor", { width: 42, height: 34 }, scene);
  floor.position.x = 145;
  floor.material = floorMaterial;
  floor.checkCollisions = true;
  const ceiling = MeshBuilder.CreateGround("lab-ceiling", { width: 42, height: 34 }, scene);
  ceiling.position.set(145, 4.4, 0);
  ceiling.rotation.x = Math.PI;
  ceiling.material = darkMetal;

  const wallSpecs: WallSpec[] = [
    [145, -17, 42, 1],
    [145, 17, 42, 1],
    [124, 0, 1, 34],
    [166, 0, 1, 34],
    [136, -10, 1, 12],
    [136, 9, 1, 14],
    [154, -8, 1, 16],
    [154, 11, 1, 10],
    // Furniture also has physical collisions, so Verity's grid must route around it.
    [129, 8, 2.6, 1.1],
    [133, 12, 2.6, 1.1],
    [142, -11, 2.6, 1.1],
    [142, -14, 1.1, 1.2],
    [144.2, -14, 1.1, 1.2],
    [146.4, -14, 1.1, 1.2],
    [142, -11.8, 1.1, 1.2],
    [144.2, -11.8, 1.1, 1.2],
    [146.4, -11.8, 1.1, 1.2],
    [158, 8, 1.5, 1.5],
    [161, 8, 1.5, 1.5],
    [158, 12, 1.5, 1.5],
    [127, -4, 1.1, 1.1],
    [130, -4, 1.1, 1.1],
    [158, 3, 1.1, 1.1],
    [161, 3, 1.1, 1.1],
  ];
  wallSpecs.forEach(([x, z, width, depth], index) => {
    const wall = MeshBuilder.CreateBox(`lab-wall-${index}`, { width, depth, height: 4.4 }, scene);
    wall.position.set(x, 2.2, z);
    wall.material = wallMaterial;
    wall.checkCollisions = true;
    wall.metadata = { blocksVision: true };
  });

  createOffice(scene, deskMaterial, screenOff);
  createServerRoom(scene, darkMetal, screenOff, warning);
  createObservationPods(scene, darkMetal, glass);
  createStorage(scene, darkMetal);
  createEmergencyLights(scene, warning);

  const terminalPositions = [
    new Vector3(129, 1.15, -12),
    new Vector3(145, 1.15, 12),
    new Vector3(161, 1.15, -12),
  ];
  const terminals = LAB_TERMINAL_IDS.map((id, index) => {
    const mesh = MeshBuilder.CreateBox(`${id}-body`, { width: 1.1, height: 1.9, depth: 0.65 }, scene);
    mesh.position.copyFrom(terminalPositions[index]);
    mesh.material = darkMetal;
    const screen = MeshBuilder.CreateBox(`${id}-screen`, { width: 0.68, height: 0.52, depth: 0.04 }, scene);
    screen.position.copyFrom(terminalPositions[index].add(new Vector3(0, 0.28, -0.345)));
    screen.material = screenOff;
    return { id, mesh, screen };
  });

  const notePosition = new Vector3(131.5, 1.03, 10.5);
  const noteMesh = MeshBuilder.CreateBox("lab-note", { width: 0.72, height: 0.04, depth: 0.5 }, scene);
  noteMesh.position.copyFrom(notePosition);
  noteMesh.rotation.y = -0.25;
  noteMesh.material = solid(scene, "lab-note-material", new Color3(0.82, 0.78, 0.62), true);

  const exitDoor = MeshBuilder.CreateBox("lab-elevator-door", { width: 0.35, height: 3.5, depth: 3 }, scene);
  exitDoor.position.copyFrom(LAB_EXIT_POSITION);
  exitDoor.material = exitLockedMaterial;
  exitDoor.checkCollisions = true;
  exitDoor.metadata = { blocksVision: true };
  const exitLight = new PointLight("lab-exit-light", LAB_EXIT_POSITION.add(new Vector3(-0.8, 1.2, 0)), scene);
  exitLight.diffuse = new Color3(0.08, 1, 0.45);
  exitLight.intensity = 0;
  exitLight.range = 7;

  return {
    wallSpecs,
    terminals,
    terminalInactiveMaterial: screenOff,
    terminalActiveMaterial: screenOn,
    notePosition,
    noteMesh,
    exitDoor,
    exitLockedMaterial,
    exitReadyMaterial,
    exitLight,
  };
}

function createOffice(scene: Scene, desk: StandardMaterial, screen: StandardMaterial): void {
  [
    new Vector3(129, 0.78, 8),
    new Vector3(133, 0.78, 12),
    new Vector3(142, 0.78, -11),
  ].forEach((position, index) => {
    const table = MeshBuilder.CreateBox(`lab-desk-${index}`, { width: 2.6, height: 0.18, depth: 1.1 }, scene);
    table.position.copyFrom(position);
    table.material = desk;
    table.checkCollisions = true;
    const monitor = MeshBuilder.CreateBox(`lab-monitor-${index}`, { width: 0.85, height: 0.58, depth: 0.1 }, scene);
    monitor.position.copyFrom(position.add(new Vector3(0, 0.52, 0)));
    monitor.material = screen;
  });
}

function createServerRoom(
  scene: Scene,
  metal: StandardMaterial,
  screen: StandardMaterial,
  warning: StandardMaterial,
): void {
  for (let index = 0; index < 6; index += 1) {
    const rack = MeshBuilder.CreateBox(`lab-server-rack-${index}`, { width: 1.1, height: 3, depth: 1.2 }, scene);
    rack.position.set(142 + (index % 3) * 2.2, 1.5, -14 + Math.floor(index / 3) * 2.2);
    rack.material = metal;
    rack.checkCollisions = true;
    const light = MeshBuilder.CreateBox(`lab-server-light-${index}`, { width: 0.48, height: 0.12, depth: 0.03 }, scene);
    light.position.copyFrom(rack.position.add(new Vector3(0, 0.5, -0.615)));
    light.material = index % 2 === 0 ? screen : warning;
  }
}

function createObservationPods(scene: Scene, metal: StandardMaterial, glass: StandardMaterial): void {
  [
    new Vector3(158, 1.55, 8),
    new Vector3(161, 1.55, 8),
    new Vector3(158, 1.55, 12),
  ].forEach((position, index) => {
    const pod = MeshBuilder.CreateCylinder(`lab-pod-${index}`, { diameter: 1.35, height: 3.1, tessellation: 16 }, scene);
    pod.position.copyFrom(position);
    pod.material = glass;
    pod.checkCollisions = true;
    const base = MeshBuilder.CreateCylinder(`lab-pod-base-${index}`, { diameter: 1.5, height: 0.2, tessellation: 16 }, scene);
    base.position.copyFrom(position.add(new Vector3(0, -1.48, 0)));
    base.material = metal;
  });
}

function createStorage(scene: Scene, material: StandardMaterial): void {
  [
    new Vector3(127, 0.55, -4),
    new Vector3(130, 0.55, -4),
    new Vector3(158, 0.55, 3),
    new Vector3(161, 0.55, 3),
  ].forEach((position, index) => {
    const crate = MeshBuilder.CreateBox(`lab-storage-${index}`, { size: 1.1 }, scene);
    crate.position.copyFrom(position);
    crate.material = material;
    crate.checkCollisions = true;
  });
}

function createEmergencyLights(scene: Scene, material: StandardMaterial): void {
  [128, 139, 151, 162].forEach((x, index) => {
    const lamp = MeshBuilder.CreateBox(`lab-emergency-lamp-${index}`, { width: 0.7, height: 0.15, depth: 0.25 }, scene);
    lamp.position.set(x, 3.85, index % 2 === 0 ? -6 : 6);
    lamp.material = material;
    const light = new PointLight(`lab-emergency-light-${index}`, lamp.position.add(new Vector3(0, -0.25, 0)), scene);
    light.diffuse = new Color3(1, 0.06, 0.025);
    light.intensity = 0.48;
    light.range = 7;
  });
}

function solid(scene: Scene, name: string, color: Color3, emissive = false): StandardMaterial {
  const result = new StandardMaterial(name, scene);
  result.diffuseColor = color;
  result.specularColor = Color3.Black();
  if (emissive) result.emissiveColor = color.scale(0.62);
  return result;
}
