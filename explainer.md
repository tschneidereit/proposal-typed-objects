# Explainer for Typed Objects

## Outline

The explainer proceeds as follows:

- [Explainer for Typed Objects](#explainer-for-typed-objects)
    - [Outline](#outline)
    - [Type definitions](#type-definitions)
        - [Primitive type definitions](#primitive-type-definitions)
        - [Struct type definitions](#struct-type-definitions)
            - [Typed field definitions](#typed-field-definitions)
            - [Untyped member definitions](#untyped-member-definitions)
    - [Instantiation](#instantiation)
        - [Instantiating struct types](#instantiating-struct-types)

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
