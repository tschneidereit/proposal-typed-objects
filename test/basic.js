/*---
flags: [module]
---*/

import { StructType, int32 } from "./../TypedObject.js";

const Point2D = new StructType(
  [{ name: "x", type: int32 }, { name: "y", type: int32 }],
  [],
  "Point2D"
);

const Line = new StructType(
  [{ name: "start", type: Point2D }, { name: "end", type: Point2D }],
  [
    {
      name: "length",
      get: function length() {
        return Math.sqrt((this.end.x - this.start.x) ** 2 + (this.end.y - this.start.y) ** 2);
      }
    },
    {
      name: "moveStart",
      value: function moveStart(dX, dY) {
        this.start.x += dX;
        this.start.y += dY;
      }
    }
  ],
  "Line"
);

let start = new Point2D(10);
assert.sameValue(start.x, 10);
assert.sameValue(start[0], 10);
assert.sameValue(start.y, 0);
assert.sameValue(start[1], 0);

let line = new Line(start);
assert.sameValue(line.start, start);
assert.sameValue(line[0], start);
assert.sameValue(line.end, null);
assert.sameValue(line[1], line.end);

line.end = Point2D.fromObject({ x: "10", y: 20.5 });
assert.sameValue(line.length, 20);
line.moveStart(10, 20);
assert.sameValue(line.length, 10);

let end = new Point2D();
line.end = end;
assert.sameValue(line.end, end);
assert.sameValue(line[1], end);
line[1] = new Point2D();
assert.notSameValue(line.end, end);
assert.sameValue(line.end, line[1]);

assert.throws(TypeError, () => {
  new StructType([{ name: "member", type: int32}, {name: "member", type: int32}], [], "Type");
}, "Repeating named typed field");

assert.throws(TypeError, () => {
  new StructType([{ name: "member", type: int32}], [{name: "member", value: 42}], [], "Type");
}, "Repeating named typed field as untyped member");

assert.throws(TypeError, () => {
  new StructType([], [{ name: "member", type: 7}, {name: "member", value: 42}], [], "Type");
}, "Repeating untyped member");
