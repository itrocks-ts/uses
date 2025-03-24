import { baseType, ObjectOrType, Type } from '@itrocks/class-type'
import { decorate, ownDecoratorOf }     from '@itrocks/decorator/class'

export function Super<T extends object>(self: object): T
{
	return Object.getPrototypeOf(Object.getPrototypeOf(self))
}

function uses<T extends Type>(target: T, mixins: Type[]): T
{
	const builtTarget = (() => class extends target {
		[index: string]: any
		constructor(...args: any[]) {
			super(...args)
			for (const mixin of mixins) this[mixin.name](...args)
		}
	})()

	for (const mixin of mixins) {
		const already = ['constructor']
		let   proto   = mixin.prototype
		while (proto.constructor !== Object) {
			for (const [name, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(proto))) {
				if (already.includes(name)) continue
				already.push(name)
				Object.defineProperty(builtTarget.prototype, name, descriptor)
			}
			proto = Object.getPrototypeOf(proto)
		}
	}

	for (const mixin of mixins) {
		Object.defineProperty(builtTarget.prototype, mixin.name, {
			value: function(...args: any[]) {
				Object.assign(this, new mixin(...args))
			}
		})
	}

	return builtTarget
}

const USES = Symbol('uses')

export function Uses<T extends object>(...mixins: Type[])
{
	return (target: Type<T>) => {
		mixins = mixins.concat(usesOf(target))
		const builtTarget = uses(target, mixins)
		decorate<T>(USES, mixins)(builtTarget)
		return builtTarget
	}
}

export function usesOf(target: ObjectOrType, resolveBuiltClass = false)
{
	const usesOf = ownDecoratorOf<Type[]>(target, USES, [])
	return resolveBuiltClass
		? usesOf.map(type => baseType(type))
		: usesOf
}
