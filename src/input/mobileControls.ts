type MobileControlCallbacks = {
  onMove(x: number, forward: number): void;
  onLook(yawDelta: number, pitchDelta: number): void;
  onInteract(): void;
  onFlashlight(): void;
  onJournal(): void;
};

export class MobileControls {
  private readonly movePad: HTMLElement;
  private readonly moveThumb: HTMLElement;
  private readonly lookZone: HTMLElement;
  private movePointerId: number | null = null;
  private lookPointerId: number | null = null;
  private lastLookX = 0;
  private lastLookY = 0;

  constructor(
    private readonly root: HTMLElement,
    private readonly callbacks: MobileControlCallbacks,
  ) {
    this.movePad = requiredChild(root, "move-pad");
    this.moveThumb = requiredChild(root, "move-thumb");
    this.lookZone = requiredChild(root, "look-zone");

    this.movePad.addEventListener("pointerdown", this.onMoveStart);
    this.movePad.addEventListener("pointermove", this.onMoveUpdate);
    this.movePad.addEventListener("pointerup", this.onMoveEnd);
    this.movePad.addEventListener("pointercancel", this.onMoveEnd);

    this.lookZone.addEventListener("pointerdown", this.onLookStart);
    this.lookZone.addEventListener("pointermove", this.onLookUpdate);
    this.lookZone.addEventListener("pointerup", this.onLookEnd);
    this.lookZone.addEventListener("pointercancel", this.onLookEnd);

    requiredChild(root, "mobile-action-button").addEventListener("click", callbacks.onInteract);
    requiredChild(root, "mobile-flashlight-button").addEventListener("click", callbacks.onFlashlight);
    requiredChild(root, "mobile-journal-button").addEventListener("click", callbacks.onJournal);
  }

  show(): void {
    this.root.classList.remove("hidden");
  }

  hide(): void {
    this.root.classList.add("hidden");
    this.resetMove();
    this.lookPointerId = null;
  }

  private readonly onMoveStart = (event: PointerEvent): void => {
    if (this.movePointerId !== null) return;
    this.movePointerId = event.pointerId;
    this.movePad.setPointerCapture(event.pointerId);
    this.updateMove(event);
  };

  private readonly onMoveUpdate = (event: PointerEvent): void => {
    if (event.pointerId !== this.movePointerId) return;
    this.updateMove(event);
  };

  private readonly onMoveEnd = (event: PointerEvent): void => {
    if (event.pointerId !== this.movePointerId) return;
    this.resetMove();
  };

  private updateMove(event: PointerEvent): void {
    event.preventDefault();
    const bounds = this.movePad.getBoundingClientRect();
    const radius = bounds.width * 0.34;
    const rawX = event.clientX - (bounds.left + bounds.width / 2);
    const rawY = event.clientY - (bounds.top + bounds.height / 2);
    const length = Math.hypot(rawX, rawY);
    const scale = length > radius ? radius / length : 1;
    const x = rawX * scale;
    const y = rawY * scale;
    this.moveThumb.style.transform = `translate(${x}px, ${y}px)`;
    this.callbacks.onMove(x / radius, -y / radius);
  }

  private resetMove(): void {
    this.movePointerId = null;
    this.moveThumb.style.transform = "translate(0, 0)";
    this.callbacks.onMove(0, 0);
  }

  private readonly onLookStart = (event: PointerEvent): void => {
    if (this.lookPointerId !== null) return;
    this.lookPointerId = event.pointerId;
    this.lastLookX = event.clientX;
    this.lastLookY = event.clientY;
    this.lookZone.setPointerCapture(event.pointerId);
  };

  private readonly onLookUpdate = (event: PointerEvent): void => {
    if (event.pointerId !== this.lookPointerId) return;
    event.preventDefault();
    const deltaX = event.clientX - this.lastLookX;
    const deltaY = event.clientY - this.lastLookY;
    this.lastLookX = event.clientX;
    this.lastLookY = event.clientY;
    this.callbacks.onLook(deltaX * 0.0042, deltaY * 0.0036);
  };

  private readonly onLookEnd = (event: PointerEvent): void => {
    if (event.pointerId === this.lookPointerId) this.lookPointerId = null;
  };
}

function requiredChild(root: HTMLElement, id: string): HTMLElement {
  const element = root.querySelector<HTMLElement>(`#${id}`);
  if (!element) throw new Error(`Element #${id} not found in mobile controls`);
  return element;
}

