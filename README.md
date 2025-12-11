[![npm version](https://img.shields.io/npm/v/@itrocks/uses?logo=npm)](https://www.npmjs.org/package/@itrocks/uses)
[![npm downloads](https://img.shields.io/npm/dm/@itrocks/uses)](https://www.npmjs.org/package/@itrocks/uses)
[![GitHub](https://img.shields.io/github/last-commit/itrocks-ts/uses?color=2dba4e&label=commit&logo=github)](https://github.com/itrocks-ts/uses)
[![issues](https://img.shields.io/github/issues/itrocks-ts/uses)](https://github.com/itrocks-ts/uses/issues)
[![discord](https://img.shields.io/discord/1314141024020467782?color=7289da&label=discord&logo=discord&logoColor=white)](https://25.re/ditr)

# uses

Apply reusable mixins to your classes effortlessly with the @Uses decorator.

*This documentation was written by an artificial intelligence and may contain errors or approximations.
It has not yet been fully reviewed by a human. If anything seems unclear or incomplete,
please feel free to contact the author of this package.*

## Installation

```bash
npm i @itrocks/uses
```

This package is published as an ES module and CommonJS module. You can use it from
plain TypeScript/Node.js projects or inside the it.rocks ecosystem.

## Usage

### Minimal example

`@itrocks/uses` lets you declare **mixins** as regular classes and apply them to
other classes using the `@Uses` decorator.

```ts
import { Uses } from '@itrocks/uses'

class TimestampMixin {
  createdAt = new Date()

  touch() {
    this.createdAt = new Date()
  }
}

@Uses(TimestampMixin)
class User {
  name = ''
}

const user = new User()
user.touch()
console.log(user.createdAt instanceof Date) // true
```

At runtime, instances of `User` behave as if all properties and methods from
`TimestampMixin` were defined directly on `User`.

### Complete example with multiple mixins and interfaces

You can freely combine several mixins, including mixins that extend other
classes. The recommended pattern is to declare an `interface` that extends all
mixins so that TypeScript understands the composed type.

```ts
import { Uses, usesOf } from '@itrocks/uses'

class AddressMixin {
  street = ''
  city   = ''

  fullAddress() {
    return `${this.street}, ${this.city}`
  }
}

class AuditableMixin {
  createdAt = new Date()
  updatedAt = new Date()

  markUpdated() {
    this.updatedAt = new Date()
  }
}

// Optional: help TypeScript understand the full shape of the class
interface Customer extends AddressMixin, AuditableMixin {}

@Uses(AddressMixin, AuditableMixin)
class Customer {
  name = ''
}

const customer = new Customer()
customer.street = '221B Baker Street'
customer.city   = 'London'
customer.markUpdated()

console.log(customer.fullAddress())
// → "221B Baker Street, London"

console.log(usesOf(Customer))
// → [AddressMixin, AuditableMixin]
```

This example shows:

- how to apply several mixins with `@Uses`,
- how to keep type safety using `interface` declarations,
- how to introspect which mixins were applied with `usesOf()`.

### Using `Super` to call overridden methods in mixins

When mixins override methods that already exist on your class, you may still
want to call the original implementation. The `Super()` helper lets you do
that in a controlled way.

```ts
import { Super, Uses } from '@itrocks/uses'

class LoggingMixin {
  log(message: string) {
    console.log('[log]', message)
  }
}

class TimedLoggingMixin {
  log(message: string) {
    const parent = Super<LoggingMixin>(this)
    return parent.log.call(this, `[${new Date().toISOString()}] ${message}`)
  }
}

@Uses(LoggingMixin, TimedLoggingMixin)
class Service {
  doWork() {
    this.log('starting')
  }
}

new Service().doWork()
```

Here `Super<LoggingMixin>(this)` gives access to the previous implementation of
`log()` so that the mixin can decorate it.

### Enriching declaration files with the TypeScript plugin

The package ships a small TypeScript transformer under
`@itrocks/uses/uses-interface-plugin`. It automatically generates
`interface` declarations for classes that use the `@Uses` decorator and, when
necessary, adjusts default exports in declaration files.

This is useful when you distribute `.d.ts` files and want consumers to see the
full mixed‑in shape of your classes.

`tsconfig.json` example:

```jsonc
{
  "compilerOptions": {
    "plugins": [
      {
        "transform": "@itrocks/uses/uses-interface-plugin"
      }
    ]
  }
}
```

The plugin runs during TypeScript compilation; no runtime code change is
required in your application.

## API

### `function Uses<T extends object>(...mixins: Type[]): (target: Type<T>) => Type<T>`

Decorator factory that applies one or more **mixin classes** to a target
class. The resulting class:

- inherits all instance methods and properties from each mixin (including
  those defined on parent classes of the mixin),
- calls each mixin constructor logic once from the target constructor,
- records the list of mixins so that `usesOf()` can retrieve it later.

Parameters:

- `mixins: Type[]` — the mixin classes to apply.

Returns:

- a decorator function `(target: Type<T>) => Type<T>` that produces a new
  class extending the original `target` and enhanced with all mixins.

Usage notes:

- You can stack several `@Uses()` decorators on the same class; mixins from
  all decorators are combined.
- The order of mixins matters when they override the same method or property:
  the last one wins.
- For best type inference, declare an `interface` that extends all mixins and
  has the same name as the decorated class.

### `function usesOf(target: ObjectOrType, resolveBuiltClass?: boolean): Type[]`

Returns the list of mixin classes attached to a class or instance via the
`@Uses` decorator.

Parameters:

- `target: ObjectOrType` — either the class itself or an instance of that
  class.
- `resolveBuiltClass = false` — when `true`, unwraps internal helper classes so
  that you always get the original mixin type (useful in advanced reflection
  scenarios).

Returns:

- an array of mixin `Type` objects, in the order they were applied.

Examples:

```ts
usesOf(Customer)        // [AddressMixin, AuditableMixin]
usesOf(new Customer())  // [AddressMixin, AuditableMixin]
usesOf(Customer, true)  // same mixins, unwrapped from internal helper classes
```

### `function Super<T extends object>(self: object): T`

Helper to access the **previous implementation** of methods when mixins
override them.

`Super()` walks up the prototype chain and returns an object whose methods can
be used as the "super" implementation for the current context.

Parameters:

- `self: object` — the current `this` value inside the overriding method.

Returns:

- an object `T` exposing the parent implementation of the class where the
  method was previously defined.

Typical usage:

```ts
class MixinParent {
  method() {
    return 'parent'
  }
}

class Mixin extends MixinParent {
  method() {
    const parent = Super<MixinParent>(this)
    return parent.method.call(this) + '-child'
  }
}
```

### `@itrocks/uses/uses-interface-plugin` (TypeScript transformer)

Default export:

```ts
import usesInterfacePlugin from '@itrocks/uses/uses-interface-plugin'
```

This is a factory that returns a TypeScript transformer function. When enabled
through `tsconfig.json` it:

- scans source files for classes decorated with `@Uses`,
- tracks which identifiers are used as mixins,
- generates `interface` declarations that extend all mixins for those
  classes (if they do not already exist),
- updates the class declaration in `.d.ts` files to be `declare class`,
- optionally adds or adjusts a default `export` for declaration files when the
  original class was a default export.

You usually do not import or call this transformer directly in your
application code; instead you configure it as a compiler plugin as shown in
the usage section.

## Typical use cases

- Share behaviour (methods and state) across several domain classes without
  building deep inheritance hierarchies.
- Add cross‑cutting concerns such as timestamps, auditing, logging or access
  control using mixins.
- Model technical capabilities ("has address", "is activable", "is
  soft‑deletable", …) as reusable mixin classes.
- Inspect which mixins are applied to a class at runtime using `usesOf()`;
  useful for reflection tools, serializers or UI generators.
- Override existing methods in mixins while still delegating to the previous
  implementation using `Super()`.
- Produce accurate `.d.ts` files for mixed‑in classes in libraries by enabling
  the `uses-interface-plugin` TypeScript transformer.
