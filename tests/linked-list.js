import { StructType } from "../TypedObject.js";

const LinkedList = StructType.declare("LinkedList");
LinkedList.define([{ name: "next", type: LinkedList }]);

let list = new LinkedList();
list.next = new LinkedList();

console.log(list + '');