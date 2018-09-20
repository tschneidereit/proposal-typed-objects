# Explainer for Typed Objects

## Outline

The explainer proceeds as follows:

- [Explainer for Typed Objects](#explainer-for-typed-objects)
    - [Outline](#outline)
    - [Overview](#overview)
        - [Characteristics of Struct types](#characteristics-of-struct-types)
    - [Type definitions](#type-definitions)
        - [Primitive type definitions](#primitive-type-definitions)
        - [Struct type definitions](#struct-type-definitions)
            - [Typed field definitions](#typed-field-definitions)
            - [Untyped member definitions](#untyped-member-definitions)
            - [Struct type forward declaration](#struct-type-forward-declaration)
    - [Instantiation](#instantiation)
        - [Instantiating struct types](#instantiating-struct-types)
    - [Struct type details](#struct-type-details)
        - [Typed fields](#typed-fields)
            - [Reading from typed fields](#reading-from-typed-fields)
            - [Writing to typed fields](#writing-to-typed-fields)
            - [Immutable typed fields](#immutable-typed-fields)
            - [Named typed fields](#named-typed-fields)
        - [Untyped members](#untyped-members)
        - [Inheritance](#inheritance)
            - [Overriding named fields and members](#overriding-named-fields-and-members)
        - [Prototypes](#prototypes)
        - [Shared Base Constructors](#shared-base-constructors)
        - [Immutable prototypes](#immutable-prototypes)

## Overview

Typed Objects add a new type of objects to JavaScript: objects with pre-defined storage for member fields with equally pre-defined types. This proposal focuses on mutable Struct types, but the concept is applicable to Value types, too.

### Characteristics of Struct types

Struct Types have these characteristics:
 - Fixed layout: a Struct's layout is fixed during construction, i.e. it is sealed during its entire lifetime.
 - Indexed typed member fields: a Struct has as own members an indexed list of typed fields, as given in its [definition](#struct-type-definitions).
 - Possible field types: typed fields can hold values as described in the [section on primitive type definitions](#primitive-type-definitions), or references to other Struct type instances.
 - Named aliases as `prototype` accessors: typed fields can optionally be given a—String or Symbol—name, in which case an accessor is installed on the `prototype`.
 - Untyped members: Struct types can also be given a list of untyped members—both values and accessors—which are installed on its `prototype`.
 - Support for recursive types: Struct types can be forward-declared and filled in later, enabling support for—directly or indirectly—recursive types.
 - Inheritance: Struct types can extend other Struct types (but not other JS classes/constructor functions). Additional typed fields are appended to the end of the parent type's indexed list.
 - Prototypes immutable in identity and shape: a Struct type's prototype chain is immutable—`setPrototypeOf` throws—and all prototypes are sealed.

See individual sections for more details on these characteristics.

## Type definitions

The central part of the Typed Objects specification are *type definition objects*, generally called *type definitions* for short. Type definitions describe the fixed structure of a value, plus optionally typed and untyped named members.

### Primitive type definitions

The system comes predefined with type definitions for all the
primitive types:

    uint8  int8  float32 any
    uint16 int16 float64 string
    uint32 int32         object

These primitive type definitions represent the various kinds of
existing JS values. For example, the type `float64` describes a JS
number, and `string` defines a JS string. The type `object` indicates
a pointer to a JS object. Finally, `any` can be any kind of value
(`undefined`, number, string, pointer to object, etc).

Primitive type definitions can be called, in which case they act as a
kind of cast or coercion. For numeric types, these coercions will
first convert the value to a number (as is common with JS) and then
coerce the value into the specified size:

```js
int8(128)   // returns 127
int8("128") // returns 127
int8(2.2)   // returns 2
int8({valueOf() {return "2.2"}}) // returns 2
int8({}) // returns 0, because Number({}) results in NaN, which is replaced with the default value 0.
```

If you're familiar with C, these coercions are basically equivalent to
C casts.

In some cases, coercions can throw. For example, in the case of
`object`, the value being coerced must be an object or `null`:

```js
object("foo") // throws
object({})    // returns the object {}
object(null)  // returns null
```

Finally, in the case of `any`, the coercion is a no-op, because any
kind of value is acceptable:

```js
any(x) === x
```

In this spec, the set of primitive type definitions cannot be extended.

### Struct type definitions

Struct types are defined using the `StructType` constructor. There are two overloads of that constructor:

```js
function StructType(typedFields, untypedMembers, name)
function StructType(baseType, typedFields, untypedMembers, name)
```

The difference between the two overloads is whether the type inherits from the base struct type, `Struct`, or a more specialized type.

Parameters:
 - `baseType` - A `constructor function` whose instances are `instanceof Struct`, i.e. `Struct` or a sub-class of `Struct`.
 - `typedFields` - An `Iterable` list of [typed field definitions](#typed-field-definitions).
 - `untypedMembers` - An `Iterable` list of [untyped member definitions](#untyped-member-definitions).
 - `name` - A `string` used as the type's name.

#### Typed field definitions

A typed field definition is an `object` definining the characteristics of a `Struct`'s typed field. It contains the following members:
 - `type` - A [type definition](#type-definition), specifying the field's type.
 - `name` [optional] - A `string` or `symbol` used as an optional name for the field. If given, an accessor is created that allows reading and, if the field is writable, writing the field using a name in addition to its index.
 - `readonly` [optional] - A `boolean`. If `true`, the field can only be set via the type's constructor and is immutable afterwards.

#### Untyped member definitions

An untyped member definition is an `object` definining the characteristics of a `Struct`'s untyped member. It contains the following members:
 - One of the following:
   - `value` - An arbitrary `JS value` to be stored under the given `name`, most commonly a `function` to be used as a method.
   - An accessor, consisting of
     - `get` [optional] - A `function` used as the member's getter.
     - `set` [optional] - A `function` used as the member's setter.
 - `name` - A `string` or `symbol` used as an optional name for the field. If given, an accessor is created that allows reading and, if the field is writable, writing the field using a name in addition to its index.

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
LinkedList.define([{ name: "next", type: LinkedList }], []);
```

`define` takes two parameters, `typedFields` and `untypedMembers`, and performs the same steps for defining the type's fields and `prototype` members as `new StructType` does.


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
const Line  = new StructType([{ name: "from", type: Point }, { name: "to", type: Point }]);

let from = new Point(42, 7);
let line = new Line(from);
console.log(line.from === from, line[0] === line.from, line.from.x); //logs "true, true, 42"
```

## Struct type details

### Typed fields

Struct types will be specified as a new kind of [Integer-indexed Exotic Object](https://tc39.github.io/ecma262/#sec-integer-indexed-exotic-objects): Struct types have their property access related internal methods overridden to perform type checking and coercion, and a Struct instance has a list of internal slots as storage for its typed member fields.

#### Reading from typed fields

Reading a typed field doesn't involve any new behavior.

For fields with numeric primitive types, it's largely comparable to reading from Typed Arrays in that the stored value is returned as a `Number`.

For fields with all other types, the value is returned as-is.

#### Writing to typed fields

When writing to a typed field, behavior depends on the field's type:
 - for [primitive types](#primitive-type-definitions), the type's coercion function is applied to the value, resulting in a coerced value to be stored, or an exception being thrown.
 - for [Struct types](#struct-type-definitions), the value is type checked: if it's not an instance of the expected type or of a type extending it, a `TypeError` is thrown. No coercion or conversion is attempted.

Writing to a field that doesn't exist on the Struct type throws.

#### Immutable typed fields

Typed fields can be marked as `readonly`, in which case any attempt to write to them after the Struct's construction throws an error.

#### Named typed fields

When defining a Struct type, its typed fields can optionally be given names. These names can be strings or symbols, with the only restriction being that a string name can't be a valid numeric index, i.e. [CanonicalNumericIndexString](https://tc39.github.io/ecma262/#sec-canonicalnumericindexstring) must return `undefined`.

If a typed field is named, an accessor with that name will be added to the Struct type's `prototype`. That accessor simply forwards `[[Get]]` and `[[Set]]` operations to the field's numeric index. Note that custom behavior can be implemented using [untyped members](#untyped-members).

### Untyped members

In addition to typed fields, Struct type definitions can also include untyped members. These are installed as values or accessors on the Struct's `prototype`, and can be used to implement custom logic for properties, and methods. Since a Struct's prototype is immutable after creation, all members have to be [supplied](#untyped-member-definitions) at the time the Struct type is defined.

Untyped members are installed after [named typed fields](#named-typed-fields). It is an error for an untyped member to have the same name as a named field.

Untyped members' names can be strings or symbols, with the only restriction being that a string name can't be a valid numeric index, i.e. [CanonicalNumericIndexString](https://tc39.github.io/ecma262/#sec-canonicalnumericindexstring) must return `undefined`.

### Inheritance

Struct types can extend other Struct types. If no base type is given, a Struct type will extend `Struct`, which is itself a Struct type without any typed fields.

A Struct type appends additional internal slots to the instances' layout: existing slots are never overridden, so sub-types can safely be treated as instances of their base types.

#### Overriding named fields and members

Named fields and members can be overridden, however there are a few restrictions:
 - Overriding a typed field must preserve both its type and whether it's mutable or immutable.
 - A typed field cannot override an untyped member.
 - An untyped member cannot override a typed field.

### Prototypes

Prototypes are set up the same way as for classes: the constructor function form one prototype chain, starting with `Struct`, and instances have another prototype chain, starting with `Struct.prototype`.

E.g., for the Struct type `Point`
 - the `[[Prototype]]` is set to `Struct`
 - the `[[Prototype]]` of instances of `Point` is set to `Point.prototype`
 - The `[[Prototype]]` of `Point.prototype` is set to `Struct.prototype`

### Shared Base Constructors

Analogously to typed arrays, which all inherit from
[`%TypedArray%`](https://tc39.github.io/ecma262/#sec-%typedarray%-intrinsic-object),
Struct types and their instances inherit from shared base constructors:

The `[[Prototype]]` of `StructType.prototype` is `%Type%.prototype`, where
`%Type%` is an intrinsic that's not directly exposed.

The `[[Prototype]]` of `Point.prototype` is `%Struct%.prototype`, where
`%Struct%` is an intrinsic that's not directly exposed.

The `[[Prototype]]` of `Point.Array.prototype` is `%Struct%.Array.prototype`,
where, again, `%Struct%` is an intrinsic that's not directly exposed.

All `[[Prototype]]`s in these hierarchies are set immutably.

In code:

```js
const Point = new StructType({{ name: "x", type: float64 }, { name: "y", type: float64 }});
const Line = new StructType({{ name: "from", type: Point }, { name: "to", type: Point }});

let point = new Point();
let points1 = new Point.Array(2);
let points2 = new Point.Array(5);
let line = new Line();

// These all yield `true`:
point.__proto__ === Point.prototype;
line.__proto__ === Line.prototype;
line.from.__proto__ === Point.prototype;

points1.__proto__ === Point.Array.prototype;
points2.__proto__ === points1.__proto__;

// Pretending %Struct% is directly exposed:
Point.prototype.__proto__ === %Struct%.prototype;
Point.Array.prototype.__proto__ === %Struct%.Array.prototype;
```

### Immutable prototypes

To ensure stability of the relationship between typed fields and their named accessors, the prototype chain of all Struct types is frozen. This means that the identity of the prototypes is immutable—`setPrototypeOf` throws—and the `prototype` objects themselves are frozen—their members can't be mutated and no new members can be added.
