const assert       = require('node:assert/strict')
const { test }     = require('node:test')
const { Uses }     = require('../cjs/uses.js')

class MixinParent
{
	mixinParentMethod() { return 'mixinParentMethod' }
}

class Mixin extends MixinParent {}
class Target {}

test('copies methods inherited by a mixin', () =>
{
	const MixedTarget = Uses(Mixin)(Target)
	assert.equal(new MixedTarget().mixinParentMethod(), 'mixinParentMethod')
})
