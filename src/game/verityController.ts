import { Ray } from "@babylonjs/core/Culling/ray";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { Scene } from "@babylonjs/core/scene";

export type WallSpec = readonly [x: number, z: number, width: number, depth: number];

export type VerityState = "sleeping" | "patrol" | "chase" | "search";

type VerityControllerOptions = {
  scene: Scene;
  mesh: Mesh;
  spawn: Vector3;
  wallSpecs: readonly WallSpec[];
  patrolPoints: readonly Vector3[];
  navigationBounds?: NavigationBounds;
  onStateChange(state: VerityState): void;
  onStep(state: VerityState): void;
  onCaught(): void;
};

export type NavigationBounds = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

const SIGHT_DISTANCE = 11;
const HEARING_DISTANCE = 7;
const LOST_SIGHT_DELAY = 2.4;
const SEARCH_DURATION = 5;

export class VerityController {
  private readonly navigator: GridNavigator;
  private readonly path: Vector3[] = [];
  private state: VerityState = "sleeping";
  private stateTime = 0;
  private timeWithoutSight = 0;
  private pathRefreshIn = 0;
  private pathTargetKey = "";
  private patrolIndex = 0;
  private distanceSinceStep = 0;
  private speedMultiplier = 1;
  private blockedFor = 0;
  private recoveryTime = 0;
  private recoverySign = 1;
  private lastKnownPlayerPosition: Vector3;

  constructor(private readonly options: VerityControllerOptions) {
    this.navigator = new GridNavigator(
      options.wallSpecs,
      options.navigationBounds ?? { minX: -13, maxX: 13, minZ: -13, maxZ: 13 },
    );
    this.lastKnownPlayerPosition = options.spawn.clone();
  }

  wake(): void {
    if (this.state === "sleeping") this.setState("patrol");
  }

  reset(awake: boolean): void {
    this.options.mesh.position.copyFrom(this.options.spawn);
    this.path.length = 0;
    this.pathTargetKey = "";
    this.pathRefreshIn = 0;
    this.patrolIndex = 0;
    this.timeWithoutSight = 0;
    this.distanceSinceStep = 0;
    this.blockedFor = 0;
    this.recoveryTime = 0;
    this.recoverySign = 1;
    this.setState(awake ? "patrol" : "sleeping", true);
  }

  debugPathLength(from: Vector3, to: Vector3): number {
    return this.navigator.findPath(from, to).length;
  }

  setAggression(stage: number): void {
    this.speedMultiplier = 1 + Math.max(0, Math.min(3, Math.floor(stage))) * 0.12;
  }

  debugSpeedMultiplier(): number {
    return this.speedMultiplier;
  }

  update(
    deltaSeconds: number,
    playerPosition: Vector3,
    playerMoving: boolean,
    playerHidden: boolean,
  ): void {
    if (this.state === "sleeping") return;

    const delta = Math.min(deltaSeconds, 0.05);
    this.stateTime += delta;
    this.pathRefreshIn -= delta;

    const distanceToPlayer = horizontalDistance(this.options.mesh.position, playerPosition);
    const seesPlayer =
      !playerHidden && distanceToPlayer <= SIGHT_DISTANCE && this.hasLineOfSight(playerPosition);

    if (seesPlayer) {
      this.lastKnownPlayerPosition.copyFrom(playerPosition);
      this.timeWithoutSight = 0;
      this.setState("chase");
    } else if (this.state === "chase") {
      this.timeWithoutSight += delta;
      if (this.timeWithoutSight >= LOST_SIGHT_DELAY) this.setState("search");
    } else if (!playerHidden && playerMoving && distanceToPlayer <= HEARING_DISTANCE) {
      this.lastKnownPlayerPosition.copyFrom(playerPosition);
      this.setState("search");
    }

    const target = this.currentTarget(playerPosition);
    if (target) this.moveTowards(target, delta);

    if (!playerHidden && horizontalDistance(this.options.mesh.position, playerPosition) < 1.25) {
      this.options.onCaught();
    }
  }

  private currentTarget(playerPosition: Vector3): Vector3 | null {
    if (this.state === "chase") return playerPosition;

    if (this.state === "search") {
      if (
        horizontalDistance(this.options.mesh.position, this.lastKnownPlayerPosition) < 0.8 &&
        this.stateTime >= SEARCH_DURATION
      ) {
        this.setState("patrol");
      } else {
        return this.lastKnownPlayerPosition;
      }
    }

    const patrolTarget = this.options.patrolPoints[this.patrolIndex];
    if (horizontalDistance(this.options.mesh.position, patrolTarget) < 0.8) {
      this.patrolIndex = (this.patrolIndex + 1) % this.options.patrolPoints.length;
      this.pathRefreshIn = 0;
      return this.options.patrolPoints[this.patrolIndex];
    }
    return patrolTarget;
  }

  private moveTowards(target: Vector3, delta: number): void {
    const targetKey = this.navigator.positionKey(target);
    const refreshInterval = this.state === "chase" ? 0.35 : 0.8;

    if (this.pathRefreshIn <= 0 || targetKey !== this.pathTargetKey || this.path.length === 0) {
      this.path.length = 0;
      this.path.push(...this.navigator.findPath(this.options.mesh.position, target));
      this.pathTargetKey = targetKey;
      this.pathRefreshIn = refreshInterval;
    }

    while (this.path.length > 0 && horizontalDistance(this.options.mesh.position, this.path[0]) < 0.28) {
      this.path.shift();
    }

    const next = this.path[0];
    if (!next) return;

    const direction = next.subtract(this.options.mesh.position);
    direction.y = 0;
    if (direction.lengthSquared() < 0.001) return;

    const baseSpeed = this.state === "chase" ? 2.65 : this.state === "search" ? 1.85 : 1.35;
    const speed = baseSpeed * this.speedMultiplier;
    const normalized = direction.normalize();
    let movementDirection = normalized;
    if (this.recoveryTime > 0) {
      movementDirection = new Vector3(-normalized.z * this.recoverySign, 0, normalized.x * this.recoverySign);
      this.recoveryTime = Math.max(0, this.recoveryTime - delta);
    }
    const previousPosition = this.options.mesh.position.clone();
    this.options.mesh.moveWithCollisions(movementDirection.scale(speed * delta));
    const movedDistance = horizontalDistance(previousPosition, this.options.mesh.position);
    this.distanceSinceStep += movedDistance;
    if (movedDistance < speed * delta * 0.12) {
      this.blockedFor += delta;
      if (this.blockedFor >= 0.55) {
        this.blockedFor = 0;
        this.recoveryTime = 0.72;
        this.recoverySign *= -1;
        this.path.length = 0;
        this.pathRefreshIn = 0;
      }
    } else {
      this.blockedFor = 0;
    }
    const stepDistance = this.state === "chase" ? 0.82 : 1.15;
    if (this.distanceSinceStep >= stepDistance) {
      this.distanceSinceStep = 0;
      this.options.onStep(this.state);
    }
    const targetYaw = Math.atan2(movementDirection.x, movementDirection.z);
    this.options.mesh.rotation.y = lerpAngle(
      this.options.mesh.rotation.y,
      targetYaw,
      Math.min(1, delta * 7),
    );
  }

  private hasLineOfSight(playerPosition: Vector3): boolean {
    const origin = this.options.mesh.position.add(new Vector3(0, 0.2, 0));
    const direction = playerPosition.subtract(origin);
    const distance = direction.length();
    if (distance <= 0.01) return true;

    const ray = new Ray(origin, direction.normalize(), distance);
    const hit = this.options.scene.pickWithRay(
      ray,
      (mesh) => mesh.metadata?.blocksVision === true,
      true,
    );
    return !hit?.hit;
  }

  private setState(next: VerityState, force = false): void {
    if (!force && this.state === next) return;
    this.state = next;
    this.stateTime = 0;
    this.pathRefreshIn = 0;
    this.pathTargetKey = "";
    this.options.onStateChange(next);
  }
}

type GridCell = {
  x: number;
  z: number;
};

const WALL_CLEARANCE = 0.68;

class GridNavigator {
  constructor(
    private readonly walls: readonly WallSpec[],
    private readonly bounds: NavigationBounds,
  ) {}

  positionKey(position: Vector3): string {
    return cellKey(this.toCell(position));
  }

  findPath(startPosition: Vector3, targetPosition: Vector3): Vector3[] {
    const start = this.nearestWalkable(this.toCell(startPosition));
    const target = this.nearestWalkable(this.toCell(targetPosition));
    const startKey = cellKey(start);
    const targetKey = cellKey(target);
    if (startKey === targetKey) return [this.toWorld(target)];

    const open = new Map<string, GridCell>([[startKey, start]]);
    const cameFrom = new Map<string, string>();
    const gScore = new Map<string, number>([[startKey, 0]]);
    const fScore = new Map<string, number>([[startKey, manhattan(start, target)]]);

    while (open.size > 0) {
      const current = lowestScoreCell(open, fScore);
      const currentKey = cellKey(current);
      if (currentKey === targetKey) return this.reconstruct(cameFrom, currentKey);
      open.delete(currentKey);

      for (const neighbor of this.neighbors(current)) {
        const neighborKey = cellKey(neighbor);
        const tentative = (gScore.get(currentKey) ?? Number.POSITIVE_INFINITY) + 1;
        if (tentative >= (gScore.get(neighborKey) ?? Number.POSITIVE_INFINITY)) continue;

        cameFrom.set(neighborKey, currentKey);
        gScore.set(neighborKey, tentative);
        fScore.set(neighborKey, tentative + manhattan(neighbor, target));
        open.set(neighborKey, neighbor);
      }
    }

    return [];
  }

  private reconstruct(cameFrom: Map<string, string>, endKey: string): Vector3[] {
    const cells: GridCell[] = [parseCellKey(endKey)];
    let currentKey = endKey;
    while (cameFrom.has(currentKey)) {
      currentKey = cameFrom.get(currentKey)!;
      cells.push(parseCellKey(currentKey));
    }
    cells.reverse();
    return cells.map((cell) => this.toWorld(cell));
  }

  private neighbors(cell: GridCell): GridCell[] {
    return [
      { x: cell.x + 1, z: cell.z },
      { x: cell.x - 1, z: cell.z },
      { x: cell.x, z: cell.z + 1 },
      { x: cell.x, z: cell.z - 1 },
    ].filter((candidate) => this.isWalkable(candidate));
  }

  private nearestWalkable(cell: GridCell): GridCell {
    if (this.isWalkable(cell)) return cell;
    for (let radius = 1; radius <= 3; radius += 1) {
      for (let x = cell.x - radius; x <= cell.x + radius; x += 1) {
        for (let z = cell.z - radius; z <= cell.z + radius; z += 1) {
          const candidate = { x, z };
          if (this.isWalkable(candidate)) return candidate;
        }
      }
    }
    return cell;
  }

  private isWalkable(cell: GridCell): boolean {
    if (
      cell.x < this.bounds.minX ||
      cell.x > this.bounds.maxX ||
      cell.z < this.bounds.minZ ||
      cell.z > this.bounds.maxZ
    ) {
      return false;
    }

    return !this.walls.some(([x, z, width, depth]) => {
      const halfWidth = width / 2 + WALL_CLEARANCE;
      const halfDepth = depth / 2 + WALL_CLEARANCE;
      return Math.abs(cell.x - x) <= halfWidth && Math.abs(cell.z - z) <= halfDepth;
    });
  }

  private toCell(position: Vector3): GridCell {
    return {
      x: clamp(Math.round(position.x), this.bounds.minX, this.bounds.maxX),
      z: clamp(Math.round(position.z), this.bounds.minZ, this.bounds.maxZ),
    };
  }

  private toWorld(cell: GridCell): Vector3 {
    return new Vector3(cell.x, 1.4, cell.z);
  }
}

function lowestScoreCell(open: Map<string, GridCell>, scores: Map<string, number>): GridCell {
  let best: GridCell | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const [key, cell] of open) {
    const score = scores.get(key) ?? Number.POSITIVE_INFINITY;
    if (score < bestScore) {
      best = cell;
      bestScore = score;
    }
  }
  return best!;
}

function manhattan(a: GridCell, b: GridCell): number {
  return Math.abs(a.x - b.x) + Math.abs(a.z - b.z);
}

function cellKey(cell: GridCell): string {
  return `${cell.x},${cell.z}`;
}

function parseCellKey(key: string): GridCell {
  const [x, z] = key.split(",").map(Number);
  return { x, z };
}

function horizontalDistance(a: Vector3, b: Vector3): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function lerpAngle(from: number, to: number, amount: number): number {
  const difference = Math.atan2(Math.sin(to - from), Math.cos(to - from));
  return from + difference * amount;
}
