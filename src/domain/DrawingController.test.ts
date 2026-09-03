import { describe, expect, it } from 'vitest';
import { DrawingController } from './DrawingController';

const p = (x: number, lng: number, time: number) => ({ x, y: 0, lng, lat: 38.13, time });

describe('DrawingController', () => {
  it('previews processed geometry and undoes a complete stroke', () => {
    const drawing = new DrawingController();
    drawing.start();
    drawing.beginStroke(p(0, -121.28, 0));
    drawing.appendPoint(p(8, -121.272, 16));
    drawing.endStroke(p(10, -121.27, 20));
    drawing.beginStroke(p(20, -121.26, 40));
    drawing.appendPoint(p(28, -121.252, 56));
    drawing.endStroke(p(30, -121.25, 60));
    expect(drawing.snapshot().canSave).toBe(true);
    drawing.undo();
    expect(drawing.snapshot().strokeCount).toBe(1);
  });

  it('clear removes only the draft and cancel exits drawing', () => {
    const drawing = new DrawingController();
    drawing.start();
    drawing.beginStroke(p(0, -121.28, 0));
    drawing.appendPoint(p(8, -121.272, 16));
    drawing.endStroke(p(10, -121.27, 20));
    drawing.clear();
    expect(drawing.snapshot()).toMatchObject({ active: true, geometry: null, canSave: false });
    drawing.cancel();
    expect(drawing.snapshot()).toMatchObject({ active: false, geometry: null });
  });
});
