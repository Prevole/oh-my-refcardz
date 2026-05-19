import { describe, expect, it } from "vitest";
import { axisOf, oppositeDirection } from "./types";

describe("axisOf", () => {
  it("maps north and south to vertical", () => {
    expect(axisOf("north")).toBe("vertical");
    expect(axisOf("south")).toBe("vertical");
  });

  it("maps east and west to horizontal", () => {
    expect(axisOf("east")).toBe("horizontal");
    expect(axisOf("west")).toBe("horizontal");
  });
});

describe("oppositeDirection", () => {
  it("inverts each cardinal direction", () => {
    expect(oppositeDirection("north")).toBe("south");
    expect(oppositeDirection("south")).toBe("north");
    expect(oppositeDirection("east")).toBe("west");
    expect(oppositeDirection("west")).toBe("east");
  });
});
