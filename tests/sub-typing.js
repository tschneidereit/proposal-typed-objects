/*---
flags: [module]
---*/

import { StructType, int32 } from "./../TypedObject.js";

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
