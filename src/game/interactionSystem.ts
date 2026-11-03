import type { Vector3 } from "@babylonjs/core/Maths/math.vector";

export type InteractionDefinition = {
  id: string;
  position(): Vector3;
  isAvailable(): boolean;
  prompt(): string;
  interact(): void;
  maxDistance?: number;
  priority?: number;
};

export class InteractionSystem {
  private readonly definitions: InteractionDefinition[] = [];

  register(definition: InteractionDefinition): void {
    if (this.definitions.some((candidate) => candidate.id === definition.id)) {
      throw new Error(`Interaction with id "${definition.id}" is already registered.`);
    }
    this.definitions.push(definition);
  }

  promptAt(playerPosition: Vector3): string | null {
    return this.nearestTo(playerPosition)?.prompt() ?? null;
  }

  interactAt(playerPosition: Vector3): string | null {
    const definition = this.nearestTo(playerPosition);
    if (!definition) return null;
    definition.interact();
    return definition.id;
  }

  private nearestTo(playerPosition: Vector3): InteractionDefinition | null {
    let best: InteractionDefinition | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    let bestPriority = Number.NEGATIVE_INFINITY;

    for (const definition of this.definitions) {
      if (!definition.isAvailable()) continue;
      const distance = VectorDistance(playerPosition, definition.position());
      if (distance > (definition.maxDistance ?? 2.25)) continue;

      const priority = definition.priority ?? 0;
      if (distance < bestDistance - 0.001 || (Math.abs(distance - bestDistance) <= 0.001 && priority > bestPriority)) {
        best = definition;
        bestDistance = distance;
        bestPriority = priority;
      }
    }

    return best;
  }
}

function VectorDistance(a: Vector3, b: Vector3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}
