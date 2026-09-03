import '@testing-library/jest-dom/vitest';

class TestPointerEvent extends MouseEvent {
  readonly pointerId: number;

  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init);
    this.pointerId = init.pointerId ?? 0;
  }
}

if (!globalThis.PointerEvent) {
  globalThis.PointerEvent = TestPointerEvent as typeof PointerEvent;
}
