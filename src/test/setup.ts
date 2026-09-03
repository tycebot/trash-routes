import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(cleanup);

if (!globalThis.PointerEvent && globalThis.MouseEvent) {
  class TestPointerEvent extends MouseEvent {
    readonly pointerId: number;

    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 0;
    }
  }

  globalThis.PointerEvent = TestPointerEvent as typeof PointerEvent;
}
