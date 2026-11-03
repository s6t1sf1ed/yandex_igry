import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import type { ICanvasRenderingContext } from "@babylonjs/core/Engines/ICanvas";
import type { Scene } from "@babylonjs/core/scene";

type VoxelPalette = {
  base: string;
  light: string;
  dark: string;
  mortar: string;
};

export function createVoxelMaterial(
  scene: Scene,
  name: string,
  palette: VoxelPalette,
  tileScale = 4,
): StandardMaterial {
  const texture = new DynamicTexture(
    `${name}-texture`,
    { width: 64, height: 64 },
    scene,
    false,
    Texture.NEAREST_SAMPLINGMODE,
  );
  const context = texture.getContext();
  context.fillStyle = palette.base;
  context.fillRect(0, 0, 64, 64);

  for (let row = 0; row < 4; row += 1) {
    for (let column = 0; column < 4; column += 1) {
      const offset = row % 2 === 0 ? 0 : 8;
      const x = column * 16 - offset;
      const y = row * 16;
      context.fillStyle = (row + column) % 3 === 0 ? palette.light : palette.base;
      context.fillRect(x + 1, y + 1, 15, 15);
      context.fillStyle = palette.dark;
      context.fillRect(x + 1, y + 13, 15, 3);
      context.fillStyle = palette.mortar;
      context.fillRect(x, y, 1, 16);
      context.fillRect(x, y, 16, 1);
    }
  }

  texture.update(false);
  texture.updateSamplingMode(Texture.TRILINEAR_SAMPLINGMODE);
  texture.anisotropicFilteringLevel = 8;
  texture.wrapU = Texture.WRAP_ADDRESSMODE;
  texture.wrapV = Texture.WRAP_ADDRESSMODE;
  texture.uScale = tileScale;
  texture.vScale = tileScale;

  const material = new StandardMaterial(name, scene);
  material.diffuseTexture = texture;
  material.diffuseColor = new Color3(0.9, 0.9, 0.9);
  material.specularColor = new Color3(0.025, 0.025, 0.025);
  return material;
}

export function createBackroomsWallpaperMaterial(scene: Scene): StandardMaterial {
  const texture = createCanvasTexture(scene, "backrooms-wallpaper", 128, 128);
  const context = texture.getContext();
  context.fillStyle = "#a89b58";
  context.fillRect(0, 0, 128, 128);

  for (let x = 0; x < 128; x += 16) {
    context.fillStyle = x % 32 === 0 ? "rgba(83, 72, 34, 0.13)" : "rgba(238, 220, 126, 0.07)";
    context.fillRect(x, 0, 2, 128);
  }
  for (let y = 10; y < 128; y += 24) {
    context.strokeStyle = "rgba(92, 79, 37, 0.17)";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(0, y);
    for (let x = 0; x <= 128; x += 8) {
      context.lineTo(x, y + Math.sin(x / 8) * 2.5);
    }
    context.stroke();
  }
  addDeterministicNoise(context, 128, 128, 900, "rgba(54, 48, 27, 0.08)");

  texture.update(false);
  texture.uScale = 2.4;
  texture.vScale = 1.7;
  const material = new StandardMaterial("backrooms-wallpaper-mat", scene);
  material.diffuseTexture = texture;
  material.diffuseColor = new Color3(0.95, 0.91, 0.68);
  material.specularColor = Color3.Black();
  return material;
}

export function createDampCarpetMaterial(scene: Scene): StandardMaterial {
  const texture = createCanvasTexture(scene, "backrooms-carpet", 96, 96);
  const context = texture.getContext();
  context.fillStyle = "#655f37";
  context.fillRect(0, 0, 96, 96);
  addDeterministicNoise(context, 96, 96, 1800, "rgba(25, 24, 15, 0.15)");
  context.fillStyle = "rgba(38, 42, 27, 0.2)";
  context.fillRect(8, 14, 34, 18);
  context.fillRect(54, 60, 29, 22);

  texture.update(false);
  texture.uScale = 7;
  texture.vScale = 7;
  const material = new StandardMaterial("backrooms-carpet-mat", scene);
  material.diffuseTexture = texture;
  material.diffuseColor = new Color3(0.83, 0.8, 0.58);
  material.specularColor = new Color3(0.025, 0.025, 0.02);
  return material;
}

export function createCeilingTileMaterial(scene: Scene): StandardMaterial {
  const texture = createCanvasTexture(scene, "backrooms-ceiling", 64, 64);
  const context = texture.getContext();
  context.fillStyle = "#9b966d";
  context.fillRect(0, 0, 64, 64);
  context.strokeStyle = "#5a573f";
  context.lineWidth = 2;
  context.strokeRect(1, 1, 62, 62);
  addDeterministicNoise(context, 64, 64, 320, "rgba(50, 48, 34, 0.09)");

  texture.update(false);
  texture.uScale = 8;
  texture.vScale = 8;
  const material = new StandardMaterial("backrooms-ceiling-mat", scene);
  material.diffuseTexture = texture;
  material.diffuseColor = new Color3(0.88, 0.86, 0.69);
  material.specularColor = Color3.Black();
  return material;
}

export function createPipeDreamsConcreteMaterial(
  scene: Scene,
  name: string,
  darkness = 0,
): StandardMaterial {
  const texture = createCanvasTexture(scene, name, 96, 96);
  const context = texture.getContext();
  const base = Math.max(42, 92 - darkness);
  context.fillStyle = `rgb(${base}, ${base + 2}, ${base + 3})`;
  context.fillRect(0, 0, 96, 96);
  addDeterministicNoise(context, 96, 96, 1300, "rgba(15, 17, 18, 0.13)");
  context.strokeStyle = "rgba(20, 22, 23, 0.2)";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(18, 0);
  context.lineTo(21, 30);
  context.lineTo(15, 58);
  context.lineTo(24, 96);
  context.stroke();
  texture.update(false);
  texture.uScale = 4;
  texture.vScale = 4;

  const material = new StandardMaterial(`${name}-mat`, scene);
  material.diffuseTexture = texture;
  material.diffuseColor = new Color3(0.82, 0.84, 0.86);
  material.specularColor = new Color3(0.035, 0.035, 0.035);
  return material;
}

function createCanvasTexture(
  scene: Scene,
  name: string,
  width: number,
  height: number,
): DynamicTexture {
  const texture = new DynamicTexture(
    `${name}-texture`,
    { width, height },
    scene,
    false,
    Texture.BILINEAR_SAMPLINGMODE,
  );
  texture.wrapU = Texture.WRAP_ADDRESSMODE;
  texture.wrapV = Texture.WRAP_ADDRESSMODE;
  texture.anisotropicFilteringLevel = 8;
  return texture;
}

function addDeterministicNoise(
  context: ICanvasRenderingContext,
  width: number,
  height: number,
  count: number,
  color: string,
): void {
  context.fillStyle = color;
  for (let index = 0; index < count; index += 1) {
    const x = (index * 47 + index * index * 13) % width;
    const y = (index * 29 + index * index * 7) % height;
    context.fillRect(x, y, 1, 1);
  }
}
