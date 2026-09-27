import { describe, expect, it } from "vitest";
import { BOX_H, boxesAt, phaseAt } from "./sort-dither";

const WIDTH = 560;

describe("sort dither", () => {
  it("grows the boxes down from the top rule", () => {
    const start = boxesAt(0, 4, 2, WIDTH);
    expect(start.every((box) => box.h === 0)).toBe(true);
    const popped = boxesAt(0.2, 4, 2, WIDTH);
    expect(popped[0]?.h).toBeGreaterThan(BOX_H / 2);
    expect(popped[0]?.y).toBeGreaterThan(4);
    expect(phaseAt(0.2)).toBe("gather");
  });

  it("flicks the row before it locks", () => {
    const early = boxesAt(0.5, 4, 2, WIDTH);
    const later = boxesAt(0.72, 4, 2, WIDTH);
    const moved = early.filter((box, index) => Math.abs(box.x - (later[index]?.x ?? box.x)) > 8);
    expect(moved.length).toBeGreaterThan(3);
    expect(phaseAt(0.72)).toBe("sort");
  });

  it("stacks the keepers and sends the rest off the frame", () => {
    const done = boxesAt(1.3, 4, 2, WIDTH);
    const kept = done.slice(0, 4);
    const dropped = done.slice(4);
    expect(kept.every((box) => Math.abs(box.x - 16) < 1)).toBe(true);
    for (let i = 1; i < kept.length; i += 1) expect(kept[i]!.y).toBeGreaterThan(kept[i - 1]!.y);
    expect(dropped.every((box) => box.x > WIDTH)).toBe(true);
    expect(done.filter((box) => box.sky)).toHaveLength(2);
    expect(phaseAt(1.3)).toBe("ranked");
  });
});
