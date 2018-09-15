/*---
flags: [module]
---*/

import { StructType } from "./../TypedObject.js";

const LinkedList = StructType.declare("LinkedList");
LinkedList.define([{ name: "next", type: LinkedList }], []);

let list = new LinkedList();
list.next = new LinkedList();

assert(list instanceof LinkedList);
assert(list.next instanceof LinkedList);
assert.sameValue(list.next.next, null);
