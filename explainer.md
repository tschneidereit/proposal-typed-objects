# Explainer for Typed Objects

## Outline

The explainer proceeds as follows:

- [Explainer for Typed Objects](#explainer-for-typed-objects)
    - [Outline](#outline)
    - [Overview](#overview)
        - [Characteristics of Struct types](#characteristics-of-struct-types)
    - [Type definitions](#type-definitions)
        - [Value type definitions](#value-type-definitions)
        - [Struct type definitions](#struct-type-definitions)
            - [Typed field definitions](#typed-field-definitions)
            - [Struct type references](#struct-type-references)
            - [Struct type forward declaration](#struct-type-forward-declaration)
    - [Instantiation](#instantiation)
        - [Instantiating struct types](#instantiating-struct-types)
    - [Struct type details](#struct-type-details)
        - [Typed fields](#typed-fields)
            - [Reading from typed fields](#reading-from-typed-fields)
            - [Writing to typed fields](#writing-to-typed-fields)
            - [Immutable typed fields](#immutable-typed-fields)
            - [Named typed fields](#named-typed-fields)
        - [Inheritance](#inheritance)
            - [Layout of subtypes](#layout-of-subtypes)
        - [Type-checking for struct type references](#type-checking-for-struct-type-references)
            - [Overriding named fields](#overriding-named-fields)
            - [Exotic behavior of Struct type instances](#exotic-behavior-of-struct-type-instances)
        - [Prototypes](#prototypes)
            - [Read-only `[[Prototype]]`](#read-only-prototype)
            - [Exotic behavior of prototypes](#exotic-behavior-of-prototypes)

## Overview

Typed Objects add a new type of objects to JavaScript: objects with pre-defined storage for member fields with equally pre-defined types. This proposal focuses on mutable Struct types, but the concept is applicable to Value types, too.

### Characteristics of Struct types

Struct Types have these characteristics:
 - Fixed layout: a Struct's layout is fixed during construction, i.e. it is sealed during its entire lifetime.
 - Indexed typed member fields: a Struct has as own members an indexed list of typed fields, as given in its [definition](#struct-type-definitions).
 - Possible field types: typed fields can hold values as described in the [section on value type definitions](#value-type-definitions), including references to other Struct type instances.
 - Named aliases as `prototype` accessors: typed fields can optionally be given a—String or Symbol—name, in which case an accessor is installed on the `prototype`.
 - Support for recursive types: Struct types can be forward-declared and filled in later, enabling support for—directly or indirectly—recursive types.
 - Inheritance: Struct types can extend other Struct types (but not other JS classes/constructor functions). Additional typed fields are appended to the end of the parent type's indexed list.
 - Prototypes are exotic objects which forbid the definition of properties that shadow typed fields, or have numeric index names.
 - Immutable prototype chain—`[[SetPrototypeOf]]` throws when applied to any members of the `Struct` prototype chain.

See individual sections for more details on these characteristics.

## Type definitions

The central part of the Typed Objects specification are *type definition objects*, generally called *type definitions* for short. Type definitions describe the fixed structure of a value, and are used to specify a struct type's fields' types.

A type definition has an internal method `[[PerformTypeCheck]]`, which, given a value `V`, returns a new value `vResult` which is of the right type, or throws.

The behavior of `[[PerformTypeCheck]]` for all types provided by this specification is described below.

Host environments can provide exotic objects with different implementations of `[[PerformTypeCheck]]`.

### Value type definitions

In addition to the `Struct` type [described below](#struct-type-definitions), Typed Objects provide a set of builtin types, exposed as functions:

    uint8  int8          any
    uint16 int16         string
    uint32 int32 float32 object
    uint64 int64 float64

These types provide implementations of the `[[PerformTypeCheck]]` internal method. Calling the type as a function executes the steps of the internal method.

The numeric types and the `string` type apply coercions: they ensure that the given value is of the right type by coercing it. For numeric types, the coercion is identical to [that applied when writing to an element in a Typed Object](https://tc39.github.io/ecma262/#sec-numbertorawbytes). For `string`, it's identical to that applied when coercing a value to string by other means, e.g. when appending it to an existing string: `"existing string" + value`.

For `object`, a type check without coercion is performed:

```js
object("foo") // throws
object({})    // returns the object {}
object(null)  // returns null
```

For [struct type references](#struct-type-references), the same kind of type check without coercion is performed, but the exact kind of check depends on the type.

For `any`, the coercion is a no-op, because any kind of value is acceptable:

```js
any(x) === x
```

### Struct type definitions

Struct types are defined using the `StructType` constructor. There are two overloads of that constructor:

```js
function StructType(typedFields, name = undefined)
function StructType(baseType, typedFields, name = undefined)
```

The difference between the two overloads is whether the type inherits from the base struct type, `Struct`, or a more specialized type.

Parameters:
 - `baseType` - A `constructor function` whose instances are `instanceof Struct`, i.e. `Struct` or a sub-class of `Struct`.
 - `typedFields` - An `Iterable` list of [typed field definitions](#typed-field-definitions).
 - `name` [optional] - A `string` used as the type's name.

#### Typed field definitions

A typed field definition is an `object` definining the characteristics of a `Struct`'s typed field. It has the following members:
 - `type` - A [type definition](#type-definition), specifying the field's type.
 - `name` [optional] - A `string` or `symbol` used as an optional name for the field. If given, an accessor is created that allows reading and, if the field is writable, writing the field using a name in addition to its index.
 - `readonly` [optional] - A `boolean`. If `true`, the field can only be set via the type's constructor and is immutable afterwards.

#### Struct type references

Just as other JS objects, struct type instances are passed by reference. When defining a struct type, it is possible to give its fields types that only permit references to certain struct types. The type used for these fields is a value type—it's immutable and passed by value—where the value is a reference to a struct type instance. Each struct type is accompanied by one of these types, which can be accessed using the `ref` field on the type's constructor:
```js
const Point = new StructType([{ name: "x", type: float64 }, { name: "y", type: float64 }]);
const Line  = new StructType([{ name: "from", type: Point.ref }, { name: "to", type: Point.ref }]);
```

#### Struct type forward declaration

To enable recursive types, it's possible to declare a Struct type without defining it. Declaration is done using `StructType.declare`, which has two overloads:
```js
StructType.declare(name)
StructType.declare(baseType, name)
```

The first overload declares a Struct type that extends `Struct`, the second creates a Struct type that extends the given `baseType`.

The type can then be defined using its `define` method:
```js
const LinkedList = StructType.declare("LinkedList");
LinkedList.define([{ name: "next", type: LinkedList.ref }]);
```

`define` takes a single parameter, `typedFields`, and performs the same steps for defining the type's fields as `new StructType` does.


## Instantiation

### Instantiating struct types

You can create an instance of a struct type using the `new` operator:

```js
const Point = new StructType([{ name: "x", type: float64 }, { name: "y", type: float64 }]);

let from = new Point();
console.log(from[0], from.x); // logs "0, 0"
```

The resulting object is called a *typed object*: it will have the fields specified in `Line`.
If no parameters are passed, each field will be initialized to its type's default value:
 - `0` for numeric types
 - `''` for `string`
 - `null` for `object` and struct type references
 - `undefined` for `any`

Any parameters passed are used as initial values for the type's typed fields:

```js
const Point = new StructType([{ name: "x", type: float64 }, { name: "y", type: float64 }]);
const Line  = new StructType([{ name: "from", type: Point.ref }, { name: "to", type: Point.ref }]);

let from = new Point(42, 7);
let line = new Line(from);
console.log(line.from === from, line[0] === line.from, line.from.x); //logs "true, true, 42"
```

## Struct type details

### Typed fields

Struct types will be specified as a new kind of [Integer-indexed Exotic Object](https://tc39.github.io/ecma262/#sec-integer-indexed-exotic-objects): Struct types have their property access related internal methods overridden to perform type checking and coercion, and a Struct instance has a list of internal slots as storage for its typed member fields.

#### Reading from typed fields

Reading a typed field doesn't involve any new behavior.

For fields with numeric types, it's identical to reading from Typed Arrays: the value [is returned as a BigInt for `int64` and `uint64`, and a Number for all other numeric types](https://tc39.github.io/proposal-bigint/#sec-rawbytestonumber).

For fields with all other types, the value is returned as-is.

#### Writing to typed fields

When writing to a typed field, the steps of the field's type's internal method `[[PerformTypeCheck]]` are executed. If the internal method completes successfully, the resulting value is stored in the field. This specification provides implementations of this internal method for [value types](#value-type-definitions) and for [struct type references](#type-checking-for-struct-type-references).

#### Immutable typed fields

Typed fields can be marked as `readonly`, in which case any attempt to write to them after the Struct's construction throws an error.

#### Named typed fields

When defining a Struct type, its typed fields can optionally be given names. These names can be strings or symbols, with the only restriction being that a string name can't be a valid numeric index, i.e. [CanonicalNumericIndexString](https://tc39.github.io/ecma262/#sec-canonicalnumericindexstring) must return `undefined`.

If a typed field is named, an accessor with that name will be added to the Struct type's `prototype`. That accessor simply forwards `[[Get]]` and `[[Set]]` operations to the field's numeric index.

### Inheritance

Struct types can extend other Struct types. If no base type is given, a Struct type will extend `Struct`, which is itself a Struct type without any typed fields.

#### Layout of subtypes

A Struct type appends additional internal slots to the instances' layout: existing slots are never overridden, so subtypes can safely be treated as instances of their base types.

### Type-checking for struct type references

The type check for struct type references ensures that the given value is an instance of either the specified type itself, or of a sub-type. The applied test has to be stronger than `instanceof`, since that is easily falsifiable, removing the guarantees around the struct's layout and behavior.

Instead, to facilitate type-checks, Struct type instances have an internal slot `[[StructType]]`, containing a reference to the associated Struct type constructor. Struct type constructors, in turn, have an internal slot `[[BaseType]]`, containing a reference to the type this type extends. For the `Struct` constructor, the value of this field is `null`.

Given a value `V`, the `[[PerformTypeCheck]]` internal method of struct type reference types performs the following steps to verify type compatibility for the given value:
 1. Let `O` be `? ToObject(V)`.
 2. If `O` does not have the internal slot `[[StructType]]`, throw a `TypeError` exception.
 3. Let `type` be `O.[[StructType]]`.
 4. Repeat, while `type` is not `null`
    1. If `type` is equal to *expectedType*, return *true*.
    2. Let `type` be `type.[[BaseType]]`.

*Note: in practice, implementations don't need to, and aren't expected to, perform this expensive test. Well-established [fast subtying checks that are equivalent to this check exist](https://www.researchgate.net/publication/221552851/download).*

#### Overriding named fields

Named fields can be overridden, but some restrictions apply:
 - A field can't change from mutable to immutable and vice-versa.
 - The type of mutable fields is invariant—the field's type must be exactly the same as the overridden field's type.
 - The type of immutable fields is covariant—the field's type can be a subtype of the overridden field's type.

#### Exotic behavior of Struct type instances

Struct type instances are exotic objects in two ways:

 1. They are [immutable prototype exotic objects](https://tc39.github.io/ecma262/#sec-immutable-prototype-exotic-objects). See the section on [read-only prototypes](#read-only-prototype) below.
 2. They override the same set of internal methods as [Integer-Indexed Exotic Objects](https://tc39.github.io/ecma262/#sec-integer-indexed-exotic-objects) to provide special handling of integer-index property keys, as [described above](#typed-fields).

### Prototypes

Prototypes are set up the same way as for classes: the constructor function form one prototype chain, starting with `Struct`, and instances have another prototype chain, starting with `Struct.prototype`.

E.g., for the Struct type `Point`
 - the `[[Prototype]]` is set to `Struct`
 - the `[[Prototype]]` of instances of `Point` is set to `Point.prototype`
 - The `[[Prototype]]` of `Point.prototype` is set to `Struct.prototype`

#### Read-only `[[Prototype]]`

The above-described prototype chains are immutable: `[[SetPrototypeOf]]` throws for all objects on the prototype chains. I.e., all these objects are [immutable prototype exotic objects](https://tc39.github.io/ecma262/#sec-immutable-prototype-exotic-objects).

#### Exotic behavior of prototypes

The prototypes of Struct instances are exotic objects in two ways:
 1. As described above, they are [immutable prototype exotic objects](https://tc39.github.io/ecma262/#sec-immutable-prototype-exotic-objects).
 2. Their overrides of `[[DefineOwnProperty]]` and `[[Set]]` prevent shadowing of [named typed fields](#named-typed-fields), and defining any integer index property key-named properties.

Combined, these rules enable the same degree of strong reasoning about a Struct type instance's fields whether it's accessed by its integer index property key, or by its—optional—string or symbol name. This also enables easier and more stable optimization in engines, leading to higher and more predictable performance.
