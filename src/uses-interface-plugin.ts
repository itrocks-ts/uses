import { type ClassDeclaration as ASTClassDeclaration } from '@itrocks/ast'
import { parse }                 from '@itrocks/ast'
import { type ClassDeclaration } from 'typescript/unstable/ast'
import { isClassDeclaration }    from 'typescript/unstable/ast'
import { isImportDeclaration }   from 'typescript/unstable/ast'
import { isNamedImports }        from 'typescript/unstable/ast'
import { type ModifierLike }     from 'typescript/unstable/ast'
import { type SourceFile }       from 'typescript/unstable/ast'
import { type Statement }        from 'typescript/unstable/ast'
import { SyntaxKind }            from 'typescript/unstable/ast'
import { TokenFlags }            from 'typescript/unstable/ast'
import * as factory              from 'typescript/unstable/ast/factory'

class UpdateOptions
{
	createImports    = new Map<string, { default: boolean, path: string }>
	updateClasses    = new Set<string>
	createExport     = ''
	createInterfaces = new Map<string, string[]>
}

const updateDeclarations = new Map<string, UpdateOptions>

function declarationKey(fileName: string)
{
	return fileName.replace(/(?:\.d)?\.[cm]?tsx?$/, '')
}

function usesDecoratorValues(node: ASTClassDeclaration)
{
	const mixins: string[] = []
	for (const decorator of node.decorators) {
		if (decorator.name !== 'Uses') continue
		for (const argument of decorator.arguments) {
			if (argument.kind !== 'identifier') continue
			mixins.push(argument.name)
		}
	}
	return mixins
}

export default () => function transformer()
{
	function createExport(className: string)
	{
		return factory.createExportAssignment(
			undefined, undefined, undefined as never, factory.createIdentifier(className)
		)
	}

	function createInterface(node: ClassDeclaration, className: string, mixins: string[])
	{
		const modifiers: ModifierLike[] = []
		if (node.modifiers?.some(modifier => (modifier.kind === SyntaxKind.ExportKeyword))) {
			modifiers.push(factory.createToken(SyntaxKind.ExportKeyword))
		}

		const heritageClause = factory.createHeritageClause(SyntaxKind.ExtendsKeyword, mixins.map(
			mixin => factory.createExpressionWithTypeArguments(factory.createIdentifier(mixin))
		))

		return factory.createInterfaceDeclaration(
			modifiers, factory.createIdentifier(className), undefined, [heritageClause], []
		)
	}

	function updateClass(node: ClassDeclaration)
	{
		const modifiers: ModifierLike[] = node.modifiers?.filter(
			modifier => (modifier.kind !== SyntaxKind.DefaultKeyword)
		) ?? []
		modifiers.push(factory.createToken(SyntaxKind.DeclareKeyword))

		return factory.updateClassDeclaration(
			node, modifiers, node.name, node.typeParameters, node.heritageClauses, node.members
		)
	}

	function visitSourceFile(sourceFile: SourceFile)
	{
		const imports           = new Map<string, { default: boolean, path: string }>
		const updateOptions     = new UpdateOptions
		const alreadyInterfaces = new Set<string>
		const sourceModule      = parse(sourceFile.text, sourceFile.fileName)

		for (const declaration of sourceModule.imports) {
			if (declaration.default) {
				imports.set(declaration.default, { default: true, path: declaration.from })
			}
			for (const specifier of declaration.named) {
				imports.set(specifier.local, { default: false, path: declaration.from })
			}
		}

		for (const declaration of sourceModule.declarations) {
			if (declaration.kind === 'class') {
				const className = declaration.name
				const mixins    = usesDecoratorValues(declaration)
				if (className && mixins.length) {
					const isDefault = declaration.isDefault

					if (isDefault) updateOptions.updateClasses.add(className)
					if (!alreadyInterfaces.has(className)) {
						updateOptions.createInterfaces.set(className, mixins)
						for (const mixin of mixins) {
							const importOptions = imports.get(mixin)
							if (importOptions) updateOptions.createImports.set(mixin, importOptions)
						}
					}
					if (isDefault) updateOptions.createExport = className
					updateDeclarations.set(declarationKey(sourceFile.fileName), updateOptions)
				}
			}

			if (declaration.kind === 'interface') {
				const className = declaration.name
				if (declaration.exported) {
					alreadyInterfaces.add(className)
					updateOptions.createInterfaces.delete(className)
				}
			}
		}
		return sourceFile
	}

	function visitDeclarationFile(sourceFile: SourceFile)
	{
		const key           = declarationKey(sourceFile.fileName)
		const updateOptions = updateDeclarations.get(key)
		if (!updateOptions) return sourceFile
		const options = updateOptions

		const imports = new Set<string>
		for (const statement of sourceFile.statements) {
			if (!isImportDeclaration(statement) || !statement.importClause) continue
			const namedBindings = statement.importClause.namedBindings
			const name          = statement.importClause.name
			if (name) imports.add(name.text)
			if (namedBindings && isNamedImports(namedBindings)) {
				namedBindings.elements.forEach(element => imports.add(element.name.text))
			}
		}

		const statements: Statement[] = []
		let importsCreated = false

		function createImports()
		{
			if (importsCreated) return
			importsCreated = true
			const sortedImports = [...options.createImports].sort(
				([mixinA, optionsA], [mixinB, optionsB]) =>
					optionsA.path.localeCompare(optionsB.path) || mixinA.localeCompare(mixinB)
			)
			sortedImports.forEach(([mixin, importOptions]) => {
				if (imports.has(mixin)) return
				statements.push(factory.createImportDeclaration(
					undefined,
					factory.createImportClause(
						undefined,
						importOptions.default ? factory.createIdentifier(mixin) : undefined,
						importOptions.default ? undefined : factory.createNamedImports([
							factory.createImportSpecifier(false, undefined, factory.createIdentifier(mixin))
						])
					),
					factory.createStringLiteral(importOptions.path, TokenFlags.None)
				))
			})
		}

		for (const statement of sourceFile.statements) {
			if (isImportDeclaration(statement)) {
				statements.push(statement)
				continue
			}

			createImports()
			if (!isClassDeclaration(statement) || !statement.name) {
				statements.push(statement)
				continue
			}

			const className = statement.name.text
			statements.push(options.updateClasses.has(className) ? updateClass(statement) : statement)
			const mixins = options.createInterfaces.get(className)
			if (mixins?.length) statements.push(createInterface(statement, className, mixins))
			if (options.createExport === className) statements.push(createExport(className))
		}
		createImports()

		const result = factory.updateSourceFile(sourceFile, statements, sourceFile.endOfFileToken)
		updateDeclarations.delete(key)
		return result
	}

	return (sourceFile: SourceFile) => sourceFile.isDeclarationFile
		? visitDeclarationFile(sourceFile)
		: visitSourceFile(sourceFile)
}
