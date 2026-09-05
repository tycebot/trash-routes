import { describe, expect, it } from 'vitest';
import { StopSequenceController } from './StopSequenceController';

describe('StopSequenceController', () => {
  it('appends each contacted stop once and reports completeness', () => {
    const controller = new StopSequenceController();
    controller.start('draw', ['a', 'b']);
    controller.contactStop('a');
    expect(controller.contactStop('a').sequence).toEqual(['a']);
    expect(controller.contactStop('b')).toMatchObject({ sequence: ['a', 'b'], canSave: true });
  });

  it('ignores unknown IDs and repeated drag contacts', () => {
    const controller = new StopSequenceController();
    controller.start('draw', ['a', 'b', 'c']);
    controller.beginPointer();
    controller.contactStop('a');
    controller.contactStop('a');
    controller.contactStop('missing');
    controller.contactStop('b');
    const snapshot = controller.endPointer();
    expect(snapshot).toMatchObject({ pointerActive: false, sequence: ['a', 'b'], canSave: false });
  });

  it('undoes the last selected stop and clears the working sequence', () => {
    const controller = new StopSequenceController();
    controller.start('draw', ['a', 'b']);
    controller.contactStop('a');
    controller.contactStop('b');
    expect(controller.undo().sequence).toEqual(['a']);
    expect(controller.clear()).toMatchObject({ active: true, sequence: [], canUndo: false });
  });

  it('cancels the working order without changing the controller after cancellation', () => {
    const controller = new StopSequenceController();
    controller.start('edit', ['a', 'b']);
    controller.contactStop('b');
    expect(controller.cancel()).toMatchObject({ active: false, sequence: [], canSave: false });
    expect(controller.contactStop('a')).toMatchObject({ active: false, sequence: [] });
  });

  it('requires every allowed stop and limits edit contacts to existing membership', () => {
    const controller = new StopSequenceController();
    expect(controller.start('edit', ['a', 'b'])).toMatchObject({
      active: true,
      sequence: [],
      canSave: false,
      validationMessage: 'Select all 2 stops before saving.',
    });
    controller.contactStop('c');
    controller.contactStop('b');
    expect(controller.snapshot().canSave).toBe(false);
    expect(controller.contactStop('a')).toMatchObject({ sequence: ['b', 'a'], canSave: true });
  });
});
