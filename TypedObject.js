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
      throw new TypeError("Sub-classes of Struct can only be created using the `StructType` constructor");
    }

    const structure = new.target.structure();
    const values = new Map();

    for (let i = 0; i < structure.length; i++) {
      const { name, type } = structure[i];
      let value = fieldValues[i];

      if (typeof value === 'undefined') {
        value = defaults.get(type);
      } else if (structTypes.has(type)) {
        if (!(value instanceof type)) {
          throw new TypeError(`Wrong type for argument ${i}: expected instance of ${type.name}, but got ${value}`);
        }
      } else {
        value = type(value);
      }

      values.set(name, value);
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
      result += ` ${type.name}(${this[field.name]}),`;
    }
    result += ` }`;
    return result;
  }

  static fromObject(sourceObject = {}) {
    const structure = this.structure();
    const values = [];

    for (let i = 0; i < structure.length; i++) {
      const { name, type } = structure[i];

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
    return null;
  }
}

freeze(Struct);

export const StructType = function(fields, lengthOrName, name) {
  const structure = [];
  class def extends Struct {
    constructor(...fieldValues) {
      super(fieldValues, properSubClassSignal);
    }
    static structure() {
      return structure;
    }
  }

  defaults.set(def, null);
  coercersMap.set(def, makeStructCoercer(def));
  structTypes.add(def);

  if (typeof lengthOrName === "number") {
    addIndexedFields(def, structure, fields, lengthOrName);
  } else {
    name = lengthOrName;
    addNamedFields(def, structure, fields);
  }

  freeze(structure);
  defineProperty(def, "name", { value: name });

  return seal(def);
};

const valuesMap = new WeakMap();
const coercersMap = new WeakMap();
const structTypes = new WeakSet();
const properSubClassSignal = Symbol("TypedObject struct sub-class");

function addNamedFields(typeDefinition, structure, fields) {
  for (let i = 0; i < fields.length; i++) {
    const { name, type, readonly = false } = fields[i];
    const field = freeze({ name, type, readonly });
    defineProperty(structure, structure.length, { value: field });
    addField(typeDefinition, field);
  }
}

function addIndexedFields(typeDefinition, structure, type, length) {
  // For now, indexed fields can't be readonly.
  const readonly = false;
  for (let i = 0; i < length; i++) {
    const field = freeze({ name: i, type, readonly });
    defineProperty(structure, structure.length, { value: field });
    addField(typeDefinition, field);
  }
}

function addField(typeDefinition, { name, type, readonly }) {
  function getter() {
    return valuesMap.get(this).get(name);
  }

  let setter;
  if (structTypes.has(type)) {
    setter = function(value) {
      if (!(value instanceof type)) {
        throw new TypeError(`Wrong type for field "${name}": expected instance of ${type.name}, but got ${value}`);
      }
      valuesMap.get(this).set(name, value);
    }
  } else {
    setter = function(value) {
      valuesMap.get(this).set(name, type(value));
    }
  }

  if (readonly) {
    setter = function(_) {
      throw new TypeError("Can't set readonly field '" + name + "'");
    };
  }
  defineProperty(typeDefinition.prototype, name, { get: getter, set: setter });
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
