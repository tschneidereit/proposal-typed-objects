// Copyright 2018 Mozilla Foundation
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

const { freeze, seal, defineProperty } = Object;

export const uint8 = makeNumericCoercer(Uint8Array, "uint8");
export const uint16 = makeNumericCoercer(Uint16Array, "uint16");
export const uint32 = makeNumericCoercer(Uint32Array, "uint32");
export const int8 = makeNumericCoercer(Int8Array, "int8");
export const int16 = makeNumericCoercer(Int16Array, "int16");
export const int32 = makeNumericCoercer(Int32Array, "int32");
export const float32 = makeNumericCoercer(Float32Array, "float32");
export const float64 = makeNumericCoercer(Float64Array, "float64");

export function any(input) {
  return input;
}

export function string(input) {
  return input + "";
}

export function object(input) {
  if (!(typeof input === "object" || typeof input === "function")) {
    throw new TypeError(`${input} is not an object`);
  }
  return input;
}

export class Struct {
  /**
   * Creates a new instance of the Struct type.
   *
   * Initial values are given as indexed parameters, with `undefined` denoting defaulted arguments.
   * Non-defaulted arguments have to be of the right type, which for Structs means either the right struct type, or a sub-class of it.
   * For primitive values, it means being numeric, or having a `valueOf` implementation that enables coercion to a number.
   * No integral or range checks are performed; instead, automatic coercion to the right integer or floating point type is performed.
   *
   * @param {...any} fieldValues Initial values for all of the Struct's fields
   */
  constructor(fieldValues, subClassSignal) {
    if (subClassSignal !== properSubClassSignal) {
      throw new TypeError(
        "Sub-classes of Struct can only be created using the `StructType` constructor"
      );
    }

    const structure = new.target.structure();
    const values = new Map();

    for (let i = 0; i < structure.length; i++) {
      const { name, type } = structure[i];
      let value = fieldValues[i];

      if (typeof value === "undefined") {
        value = defaults.get(type);
      } else if (structTypes.has(type)) {
        if (!(value instanceof type)) {
          throw new TypeError(
            `Wrong type for argument ${i}: expected instance of ${type.name}, but got ${value}`
          );
        }
      } else {
        value = type(value);
      }

      values.set(i, value);
    }

    freeze(this);
    valuesMap.set(this, values);
  }

  toString() {
    let result = `struct ${this.constructor.name} {`;
    const structure = this.constructor.structure();
    for (let i = 0; i < structure.length; i++) {
      const field = structure[i];
      const type = field.type;
      result += ` ${type.name}(${this[i]}),`;
    }
    result += ` }`;
    return result;
  }

  static fromObject(sourceObject = {}) {
    const structure = this.structure();
    const values = [];

    for (let i = 0; i < structure.length; i++) {
      const { name, type } = structure[i];

      if (name === undefined) {
        name = i;
      }

      if (!(name in sourceObject)) {
        throw new TypeError(`Field ${name} not found on source object ${sourceObject}`);
      }

      let value = sourceObject[name];

      if (value !== undefined) {
        let coercer = coercersMap.get(type) || type;
        value = coercer(value);
      } else {
        value = defaults.get(type);
      }

      values.push(value);
    }

    return new this(...values, properSubClassSignal);
  }

  static structure() {
    return structTypes.get(this);
  }

  static define(fields) {
    if (!structTypes.has(this)) {
      throw new TypeError(
        "Struct.define can only be applied to declared but not defined struct types"
      );
    }

    if (structTypes.get(this)) {
      throw new TypeError(`Struct type ${this.name} already defined`);
    }

    const structure = [];

    const baseStructure = this.__proto__.structure();
    for (let i = 0; i < baseStructure.length; i++) {
      defineProperty(structure, i, { value: baseStructure[i] });
    }

    structTypes.set(this, structure);
    addFields(this, structure, fields);

    freeze(structure);
    seal(this);
  }
}

freeze(Struct);

export const StructType = function(signalOrBaseOrFields, nameOrBaseOrFields, name = undefined) {
  let inDeclarationMode = false;
  let base = Struct;
  let fields;

  // Overloads that apply in declaration mode.
  if (signalOrBaseOrFields === declarationSignal) {
    inDeclarationMode = true;

    // Parameters 1 and 2 are different depending on the overload:
    // 1: Base class or name
    // 2: Name or undefined
    if (name) {
      base = nameOrBaseOrFields;
    } else {
      name = nameOrBaseOrFields;
    }
  } else {
    if (name !== undefined) {
      // If `name` is given, the overload must be
      // 0: Base class
      // 1: Fields
      // 2: Name
      base = signalOrBaseOrFields;
      fields = nameOrBaseOrFields;
    } else {
      // Otherwise, it must be
      // 0: Fields
      // 1: Name
      fields = signalOrBaseOrFields;
      name = nameOrBaseOrFields;
    }
  }

  class def extends base {
    constructor(...fieldValues) {
      if (base === Struct) {
        super(fieldValues, properSubClassSignal);
      } else {
        super(...fieldValues);
      }
    }
  }

  defineProperty(def, "name", { value: name });

  defaults.set(def, null);
  coercersMap.set(def, makeStructCoercer(def));
  structTypes.set(def, null);

  if (!inDeclarationMode) {
    def.define(fields);
  }

  return def;
};

StructType.declare = function(baseOrName, name = undefined) {
  return new StructType(declarationSignal, baseOrName, name);
};

const valuesMap = new WeakMap();
const coercersMap = new WeakMap();
const structTypes = new WeakMap();
structTypes.set(Struct, freeze([]));

const declarationSignal = Symbol("Struct declaration");
const properSubClassSignal = Symbol("TypedObject struct sub-class");

function addFields(typeDefinition, structure, fields) {
  let i = structure.length;
  for (const { name, type, readonly = false } of fields) {
    if (!(structTypes.has(type) || defaults.has(type))) {
      throw new TypeError(`Invalid type ${type} for field ${name}`);
    }

    // TODO: remove name
    const field = freeze({ name, type, readonly });
    defineProperty(structure, structure.length, { value: field });
    addField(typeDefinition, i, field);

    i++;
  }
}

function addField(typeDefinition, index, { name, type, readonly }) {
  function getter() {
    return valuesMap.get(this).get(index);
  }

  let setter;
  if (structTypes.has(type)) {
    setter = function(value) {
      if (!(value instanceof type)) {
        throw new TypeError(
          `Wrong type for field "${index}": expected instance of ${type.name}, but got ${value}`
        );
      }
      valuesMap.get(this).set(index, value);
    };
  } else {
    setter = function(value) {
      valuesMap.get(this).set(index, type(value));
    };
  }

  if (readonly) {
    setter = function(_) {
      throw new TypeError("Can't set readonly field '" + index + "'");
    };
  }

  if (name) {
    if (typeof name !== "symbol" && name >>> (0 + "") === name) {
      throw new TypeError(`Invalid field name ${name}: field names cannot be valid index keys`);
    }

    defineProperty(typeDefinition.prototype, name, { get: getter, set: setter });
  }

  defineProperty(typeDefinition.prototype, index, { get: getter, set: setter });
}

const defaults = new WeakMap([
  [uint8, 0],
  [uint16, 0],
  [uint32, 0],
  [int8, 0],
  [int16, 0],
  [int32, 0],
  [float32, 0],
  [float64, 0],
  [any, undefined],
  [string, ""],
  [object, null]
]);

function makeStructCoercer(structType) {
  const structCoercer = input => {
    if (input instanceof structType) {
      return input;
    }

    if (input == null) {
      return null;
    }

    return structType.fromObject(input);
  };

  defineProperty(structCoercer, "name", { value: structType.name });
  return structCoercer;
}

function makeNumericCoercer(arrayType, name) {
  const typedArray = new arrayType(1);
  const numericCoercer = input => {
    typedArray[0] = input;
    return typedArray[0];
  };
  defineProperty(numericCoercer, "name", { value: name });
  return numericCoercer;
}
