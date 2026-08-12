const assert                   = require('node:assert/strict')
const { mkdtempSync }          = require('node:fs')
const { rmSync }               = require('node:fs')
const { writeFileSync }        = require('node:fs')
const { tmpdir }               = require('node:os')
const { join }                 = require('node:path')
const { test }                 = require('node:test')
const { API }                  = require('typescript/unstable/sync')
const { isClassDeclaration }   = require('typescript/unstable/ast')
const { isExportAssignment }   = require('typescript/unstable/ast')
const { isImportDeclaration }  = require('typescript/unstable/ast')
const { isInterfaceDeclaration } = require('typescript/unstable/ast')
const { SyntaxKind }           = require('typescript/unstable/ast')
const usesInterfacePlugin      = require('../cjs/uses-interface-plugin.js').default

test('adds mixin imports and an interface to a default class declaration', () =>
{
	const directory       = mkdtempSync(join(tmpdir(), 'itrocks-uses-'))
	const sourceFileName  = join(directory, 'custom-class.ts')
	const declarationName = join(directory, 'custom-class.d.ts')

	try {
		writeFileSync(sourceFileName, [
			"import { ZedMixin, NamedMixin } from './named-mixin'",
			"import DefaultMixin from './default-mixin'",
			'@Uses(DefaultMixin, ZedMixin, NamedMixin)',
			'export default class CustomClass {}'
		].join('\n'))
		writeFileSync(declarationName, 'export default class CustomClass {}\n')

		const api      = new API({ cwd: directory })
		const snapshot = api.updateSnapshot({ openFiles: [sourceFileName, declarationName] })

		try {
			const sourceProject = snapshot.getDefaultProjectForFile(sourceFileName)
			const source        = sourceProject?.program.getSourceFile(sourceFileName)
			const declaration   = sourceProject?.program.getSourceFile(declarationName)
			assert.ok(source)
			assert.ok(declaration)

			const transform = usesInterfacePlugin({})({})
			assert.equal(transform(source), source)
			const result = transform(declaration)

			const imports = result.statements.filter(isImportDeclaration)
			assert.equal(imports.length, 3)
			assert.deepEqual(imports.map(node => node.moduleSpecifier.text), [
				'./default-mixin', './named-mixin', './named-mixin'
			])
			assert.equal(imports[0].importClause.name.text, 'DefaultMixin')
			assert.deepEqual(imports.slice(1).map(node => node.importClause.namedBindings.elements[0].name.text), [
				'NamedMixin', 'ZedMixin'
			])

			const classDeclaration = result.statements.find(isClassDeclaration)
			assert.ok(classDeclaration)
			assert.equal(
				classDeclaration.modifiers.some(modifier => modifier.kind === SyntaxKind.DefaultKeyword),
				false
			)
			assert.equal(
				classDeclaration.modifiers.some(modifier => modifier.kind === SyntaxKind.DeclareKeyword),
				true
			)

			const generatedInterface = result.statements.find(isInterfaceDeclaration)
			assert.ok(generatedInterface)
			assert.equal(generatedInterface.name.text, 'CustomClass')
			assert.deepEqual(
				generatedInterface.heritageClauses[0].types.map(type => type.expression.text),
				['DefaultMixin', 'ZedMixin', 'NamedMixin']
			)

			const exportAssignment = result.statements.find(isExportAssignment)
			assert.ok(exportAssignment)
			assert.equal(exportAssignment.expression.text, 'CustomClass')

			const output = sourceProject.emitter.printNode(result)
			assert.match(output, /import DefaultMixin from ['"]\.\/default-mixin['"];/)
			assert.match(output, /import \{ NamedMixin \} from ['"]\.\/named-mixin['"];/)
			assert.match(output, /import \{ ZedMixin \} from ['"]\.\/named-mixin['"];/)
			assert.match(output, /export declare class CustomClass/)
			assert.match(output, /export interface CustomClass extends DefaultMixin, ZedMixin, NamedMixin/)
			assert.match(output, /export default CustomClass;/)
		}
		finally {
			api.close()
		}
	}
	finally {
		rmSync(directory, { recursive: true })
	}
})
