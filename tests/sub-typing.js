import { StructType, int32 } from "../TypedObject.js";

const Point2D = new StructType(
  [{ name: "x", type: int32 }, { name: "y", type: int32 }],
  [],
  "Point2D"
);
const Point3D = new StructType(Point2D, [{ name: "z", type: int32 }], [], "Point3D");

let start = new Point3D(0, 1, 2);

console.log(start + "");

const Line = new StructType(
  [{ name: "start", type: Point2D }, { name: "end", type: Point2D }],
  [],
  "Line"
);

let line = new Line(start, new Point2D(4, 5));

console.log(line + "");
