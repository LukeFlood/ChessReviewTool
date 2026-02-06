import { describe, expect, it } from "vitest";
import { classifyCpl } from "@/lib/classification";

describe("classifyCpl", () => {
  it("assigns correct buckets", () => {
    expect(classifyCpl(10, false)).toBe("best");
    expect(classifyCpl(25, false)).toBe("good");
    expect(classifyCpl(80, false)).toBe("inaccuracy");
    expect(classifyCpl(140, false)).toBe("mistake");
    expect(classifyCpl(400, false)).toBe("blunder");
  });

  it("forces blunder on mate", () => {
    expect(classifyCpl(10, true)).toBe("blunder");
  });
});
