/*---
flags: [module]
---*/

import { StructType, int32, float32 } from "./../TypedObject.js";

const Point2D = new StructType(
  [{ name: "x", type: int32 }, { name: "y", type: int32 }],
  [],
  "Point2D"
);
const Point3D = new StructType(Point2D, [{ name: "z", type: int32 }], [], "Point3D");

let start = new Point3D(0, 1, 2);
assert(start instanceof Point3D);
assert(start instanceof Point2D);

const Line = new StructType(
  [{ name: "start", type: Point2D }, { name: "end", type: Point2D }],
  [],
  "Line"
);

let line = new Line(start, new Point3D(4, 5, 6));
assert.sameValue(line.start, start);
assert(line.end instanceof Point3D);
assert(line.end instanceof Point2D);

assert.throws(TypeError, () => {
  const InvalidOverride = new StructType(Point2D, [{ name: "x", type: float32 }], [], "Invalid");
}, "Overriding value typed field with wrong value type");

assert.throws(TypeError, () => {
  const InvalidOverride = new StructType(Point2D, [{ name: "x", type: Point2D }], [], "Invalid");
}, "Overriding value typed field with struct type");

assert.throws(TypeError, () => {
  const InvalidOverride = new StructType(Line, [{ name: "start", type: float32 }], [], "Invalid");
}, "Overriding struct type field with value type");

assert.throws(TypeError, () => {
  const InvalidOverride = new StructType(Point2D, [], [{ name: "x", value: 42 }], "Invalid");
}, "Overriding typed field with untyped member");

assert.throws(TypeError, () => {
  const Base = new StructType([], [{ name: "member", value: 42}], "Base");
  const InvalidOverride = new StructType(Base, [{ name: "member", type: int32 }], [], "Invalid");
}, "Overriding untyped member with typed field");

assert.throws(TypeError, () => {
  const InvalidOverride = new StructType(Point2D, [{ name: "x", type: int32, readonly: true }], [], "Invalid");
}, "Overriding readonly typed field with read-write field");

assert.throws(TypeError, () => {
  const Base = new StructType([{ name: "member", type: int32, readonly: true}], [], "Base");
  const InvalidOverride = new StructType(Base, [{ name: "member", type: int32, readonly: false}], [], "Invalid");
}, "Overriding read-write typed field with readonly field");
