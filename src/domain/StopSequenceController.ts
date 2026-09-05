export type SequenceMode = 'draw' | 'edit';

export interface StopSequenceSnapshot {
  active: boolean;
  pointerActive: boolean;
  sequence: string[];
  canUndo: boolean;
  canSave: boolean;
  validationMessage: string | null;
}

export class StopSequenceController {
  private active = false;
  private pointerActive = false;
  private allowedStopIds = new Set<string>();
  private sequence: string[] = [];

  start(mode: SequenceMode, allowedStopIds: string[]): StopSequenceSnapshot {
    this.active = true;
    this.pointerActive = false;
    void mode;
    this.allowedStopIds = new Set(allowedStopIds);
    this.sequence = [];
    return this.snapshot();
  }

  contactStop(stopId: string): StopSequenceSnapshot {
    if (this.active && this.allowedStopIds.has(stopId) && !this.sequence.includes(stopId)) {
      this.sequence.push(stopId);
    }
    return this.snapshot();
  }

  beginPointer(): StopSequenceSnapshot {
    if (this.active) this.pointerActive = true;
    return this.snapshot();
  }

  endPointer(): StopSequenceSnapshot {
    this.pointerActive = false;
    return this.snapshot();
  }

  undo(): StopSequenceSnapshot {
    if (this.active) this.sequence.pop();
    return this.snapshot();
  }

  clear(): StopSequenceSnapshot {
    if (this.active) this.sequence = [];
    return this.snapshot();
  }

  cancel(): StopSequenceSnapshot {
    this.active = false;
    this.pointerActive = false;
    this.allowedStopIds = new Set();
    this.sequence = [];
    return this.snapshot();
  }

  snapshot(): StopSequenceSnapshot {
    const complete = this.active && this.allowedStopIds.size > 0 &&
      this.sequence.length === this.allowedStopIds.size &&
      this.sequence.every((id) => this.allowedStopIds.has(id));
    return {
      active: this.active,
      pointerActive: this.pointerActive,
      sequence: [...this.sequence],
      canUndo: this.active && this.sequence.length > 0,
      canSave: complete,
      validationMessage: this.active && !complete
        ? `Select all ${this.allowedStopIds.size} stops before saving.`
        : null,
    };
  }
}
