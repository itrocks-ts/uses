import { Uses, usesOf } from '@itrocks/uses'

class ParentMixin2Extends {
	parentMixin2ExtendsMethod() { return 'parentMixin2ExtendsMethod' }
	parentMixin2ExtendsProperty = 'parentMixin2ExtendsProperty'
}

class ParentMixin1 {
	parentMixin1Method() { return 'parentMixin1Method' }
	parentMixin1Property = 'parentMixin1Property'
}

class ParentMixin2 extends ParentMixin2Extends {
	parentMixin2Method() { return 'parentMixin2Method' }
	parentMixin2Property = 'parentMixin2Property'
}

interface Parent extends ParentMixin1, ParentMixin2 {}
@Uses(ParentMixin1, ParentMixin2)
class Parent {
	parentMethod() { return 'parentMethod' }
	parentProperty = 'parentProperty'
}

class Mixin1Mixin1 {
	mixin1Mixin1Method() { return 'mixin1Mixin1Method' }
	mixin1Mixin1Property = 'mixin1Mixin1Property'
}

interface Mixin1 extends Mixin1Mixin1 {}
@Uses(Mixin1Mixin1)
class Mixin1 {
	mixin1Method() { return 'mixin1Method' }
	mixin1Property = 'mixin1Property'
}

class Mixin2 {
	mixin2Method() { return 'mixin2Method' }
	mixin2Property = 'mixin2Property'
}

interface Class extends Mixin1, Mixin2 {}
@Uses(Mixin1)
@Uses(Mixin2)
class Class extends Parent {
	classMethod() { return 'classMethod' }
	classProperty = 'classProperty'
}

describe('build', () =>
{

	it('getAllMethods', () =>
	{
		const object = new Class
		expect(object.classMethod()).toEqual('classMethod')
		expect(object.parentMethod()).toEqual('parentMethod')
		expect(object.mixin1Method()).toEqual('mixin1Method')
		expect(object.mixin1Mixin1Method()).toEqual('mixin1Mixin1Method')
		expect(object.mixin2Method()).toEqual('mixin2Method')
		expect(object.parentMixin1Method()).toEqual('parentMixin1Method')
		expect(object.parentMixin2Method()).toEqual('parentMixin2Method')
		expect(object.parentMixin2ExtendsMethod()).toEqual('parentMixin2ExtendsMethod')
	})

	it('getAllProperties', () =>
	{
		const object = new Class
		expect(object.classProperty).toEqual('classProperty')
		expect(object.parentProperty).toEqual('parentProperty')
		expect(object.mixin1Property).toEqual('mixin1Property')
		expect(object.mixin1Mixin1Property).toEqual('mixin1Mixin1Property')
		expect(object.mixin2Property).toEqual('mixin2Property')
		expect(object.parentMixin1Property).toEqual('parentMixin1Property')
		expect(object.parentMixin2Property).toEqual('parentMixin2Property')
		expect(object.parentMixin2ExtendsProperty).toEqual('parentMixin2ExtendsProperty')
	})

	it('usesOfClass', () => {
		expect(usesOf(Class)).toEqual([Mixin1, Mixin2])
		expect(usesOf(Class, true)).toEqual([Object.getPrototypeOf(Mixin1), Mixin2])
	})

	it('usesOfObject', () => {
		expect(usesOf(new Class)).toEqual([Mixin1, Mixin2])
		expect(usesOf(new Class, true)).toEqual([Object.getPrototypeOf(Mixin1), Mixin2])
	})

	it('usesOfMixins', () => {
		expect(usesOf(Mixin1)).toEqual([Mixin1Mixin1])
		expect(usesOf(Mixin2)).toEqual([])
		expect(usesOf(ParentMixin1)).toEqual([])
		expect(usesOf(ParentMixin2)).toEqual([])
		expect(usesOf(ParentMixin2Extends)).toEqual([])
	})

	it('usesOfParent', () => {
		expect(usesOf(Parent, true)).toEqual([ParentMixin1, ParentMixin2])
	})

})
