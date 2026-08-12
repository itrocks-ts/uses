const assert       = require('node:assert/strict')
const { test }     = require('node:test')
const { Uses }     = require('../cjs/uses.js')

class InnerMixin {}

class Mixin
{
	mixinMethod() { return 'mixinMethod' }
}

class Target {}

test('composes a mixin which itself uses another mixin', () =>
{
	const MixedMixin  = Uses(InnerMixin)(Mixin)
	const MixedTarget = Uses(MixedMixin)(Target)
	assert.equal(new MixedTarget().mixinMethod(), 'mixinMethod')
})
