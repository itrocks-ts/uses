const assert       = require('node:assert/strict')
const { test }     = require('node:test')
const { Uses }     = require('../cjs/uses.js')
const { usesOf }   = require('../cjs/uses.js')

class ParentMixin2Extends
{
	parentMixin2ExtendsMethod() { return 'parentMixin2ExtendsMethod' }
	parentMixin2ExtendsProperty = 'parentMixin2ExtendsProperty'
}

class ParentMixin1
{
	parentMixin1Method() { return 'parentMixin1Method' }
	parentMixin1Property = 'parentMixin1Property'
}

class ParentMixin2 extends ParentMixin2Extends
{
	parentMixin2Method() { return 'parentMixin2Method' }
	parentMixin2Property = 'parentMixin2Property'
}

class Parent
{
	parentMethod() { return 'parentMethod' }
	parentProperty = 'parentProperty'
}

const MixedParent = Uses(ParentMixin1, ParentMixin2)(Parent)

class Mixin1Mixin1
{
	mixin1Mixin1Method() { return 'mixin1Mixin1Method' }
	mixin1Mixin1Property = 'mixin1Mixin1Property'
}

class Mixin1
{
	mixin1Method() { return 'mixin1Method' }
	mixin1Property = 'mixin1Property'
}

const MixedMixin1 = Uses(Mixin1Mixin1)(Mixin1)

class Mixin2
{
	mixin2Method() { return 'mixin2Method' }
	mixin2Property = 'mixin2Property'
}

class Target extends MixedParent
{
	classMethod() { return 'classMethod' }
	classProperty = 'classProperty'
}

const TargetWithMixin2 = Uses(Mixin2)(Target)
const MixedTarget      = Uses(MixedMixin1)(TargetWithMixin2)

test('copies methods from mixins, nested mixins and their parents', () =>
{
	const object = new MixedTarget
	assert.equal(object.classMethod(), 'classMethod')
	assert.equal(object.parentMethod(), 'parentMethod')
	assert.equal(object.mixin1Method(), 'mixin1Method')
	assert.equal(object.mixin1Mixin1Method(), 'mixin1Mixin1Method')
	assert.equal(object.mixin2Method(), 'mixin2Method')
	assert.equal(object.parentMixin1Method(), 'parentMixin1Method')
	assert.equal(object.parentMixin2Method(), 'parentMixin2Method')
	assert.equal(object.parentMixin2ExtendsMethod(), 'parentMixin2ExtendsMethod')
})

test('initializes properties from mixins, nested mixins and their parents', () =>
{
	const object = new MixedTarget
	assert.equal(object.classProperty, 'classProperty')
	assert.equal(object.parentProperty, 'parentProperty')
	assert.equal(object.mixin1Property, 'mixin1Property')
	assert.equal(object.mixin1Mixin1Property, 'mixin1Mixin1Property')
	assert.equal(object.mixin2Property, 'mixin2Property')
	assert.equal(object.parentMixin1Property, 'parentMixin1Property')
	assert.equal(object.parentMixin2Property, 'parentMixin2Property')
	assert.equal(object.parentMixin2ExtendsProperty, 'parentMixin2ExtendsProperty')
})

test('returns mixins from a class and resolves built mixin classes', () =>
{
	assert.deepEqual(usesOf(MixedTarget), [MixedMixin1, Mixin2])
	assert.deepEqual(usesOf(MixedTarget, true), [Mixin1, Mixin2])
})

test('returns mixins from an object', () =>
{
	assert.deepEqual(usesOf(new MixedTarget), [MixedMixin1, Mixin2])
	assert.deepEqual(usesOf(new MixedTarget, true), [Mixin1, Mixin2])
})

test('returns mixins used by mixins', () =>
{
	assert.deepEqual(usesOf(MixedMixin1), [Mixin1Mixin1])
	assert.deepEqual(usesOf(Mixin2), [])
	assert.deepEqual(usesOf(ParentMixin1), [])
	assert.deepEqual(usesOf(ParentMixin2), [])
	assert.deepEqual(usesOf(ParentMixin2Extends), [])
})

test('returns mixins used by a parent', () =>
{
	assert.deepEqual(usesOf(MixedParent, true), [ParentMixin1, ParentMixin2])
})
