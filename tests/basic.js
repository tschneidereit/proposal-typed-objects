import { StructType, int32 } from "../TypedObject.js";

const Point2D = new StructType([{ name: "x", type: int32 }, { name: "y", type: int32 }], "Point2D");
const Line = new StructType(
  [{ name: "start", type: Point2D }, { name: "end", type: Point2D }],
  "Line"
);

let start = new Point2D(10);
console.log(start + "");

let line = new Line(start);
console.log(line + "");

let endInput = Point2D.fromObject({ x: "10", y: 20.5 });
line.end = endInput;
console.log(line + "");
console.log(endInput !== line.end);

let end = new Point2D();
line.end = end;
console.log(end === line.end);

const Polygon = new StructType(
  [{ type: Point2D }, { type: Point2D }, { type: Point2D }],
  "Polygon"
);
let poly = new Polygon(line.start, line.end, new Point2D({ x: 0, y: 1 }));
console.log(poly + "");

poly[0] = Point2D.fromObject({ x: 10, y: 20 });
console.log(poly[0] + "");

let startObj = { x: 10, y: 20 };
end = new Point2D({ x: 10, y: 20 });
let l2 = new Line(Point2D.fromObject(startObj), end);

end = new Point2D(10, 20);
l2 = new Line(Point2D.fromObject(startObj), Point2D.fromObject(end));
let l3 = Line.fromObject({ start: startObj, end: end });
l3.end === l2.end;
l3.end !== l2.end;

!(startObj instanceof Point2D);
l2.start instanceof Point2D;
l2.start !== startObj;

end instanceof Point2D;
l2.end instanceof Point2D;
l2.end === end;

startObj.x = 20;
end.x = 20;
