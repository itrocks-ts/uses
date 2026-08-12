const assert     = require('node:assert/strict')
const { test }   = require('node:test')
const { Super }  = require('../cjs/uses.js')
const { Uses }   = require('../cjs/uses.js')

class MixinParent
{
	a = 1
	method() { return Super(this).method.call(this) + '-mixinParentMethod' + this.a }
}

class Mixin extends MixinParent
{
	a = 2
	method() { return super.method() + '-mixinMethod' + this.a }
}

class Parent
{
	a = 3
	method() { return 'parentMethod' + this.a }
}

class Target extends Parent
{
	a = 4
	method() { return super.method() + '-method' + this.a }
}

test('chains target, parent and mixin overrides', () =>
{
	const MixedTarget = Uses(Mixin)(Target)
	assert.equal(
		new MixedTarget().method(),
		'parentMethod2-method2-mixinParentMethod2-mixinMethod2'
	)
})
