const GAME_KEYS = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "KeyF",
  "KeyP",
  "KeyM",
  "KeyR",
  "KeyL",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Enter",
  "Space",
  "Escape",
]);

export class Input {
  readonly down = new Set<string>();
  private readonly pressed = new Set<string>();
  private readonly released = new Set<string>();

  attach(target: Window | HTMLElement): void {
    target.addEventListener("keydown", this.onKeyDown);
    target.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
  }

  detach(target: Window | HTMLElement): void {
    target.removeEventListener("keydown", this.onKeyDown);
    target.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
  }

  endFrame(): void {
    this.pressed.clear();
    this.released.clear();
  }

  isDown(code: string): boolean {
    return this.down.has(code);
  }

  justPressed(code: string): boolean {
    return this.pressed.has(code);
  }

  justReleased(code: string): boolean {
    return this.released.has(code);
  }

  anyPressed(...codes: string[]): boolean {
    return codes.some((c) => this.pressed.has(c));
  }

  private onKeyDown = (ev: Event): void => {
    const e = ev as KeyboardEvent;
    if (GAME_KEYS.has(e.code)) e.preventDefault();
    if (e.repeat) return;
    this.down.add(e.code);
    this.pressed.add(e.code);
  };

  private onKeyUp = (ev: Event): void => {
    const e = ev as KeyboardEvent;
    this.down.delete(e.code);
    this.released.add(e.code);
  };

  private onBlur = (): void => {
    this.down.clear();
  };
}

export interface PlayerBinds {
  left: string;
  right: string;
  up: string;
  down: string;
  action: string[];
}

export const P1_BINDS: PlayerBinds = {
  left: "KeyA",
  right: "KeyD",
  up: "KeyW",
  down: "KeyS",
  action: ["KeyF"],
};

export const P2_BINDS: PlayerBinds = {
  left: "ArrowLeft",
  right: "ArrowRight",
  up: "ArrowUp",
  down: "ArrowDown",
  action: ["KeyL", "Enter"],
};
