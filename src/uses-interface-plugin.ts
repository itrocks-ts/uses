import { type ClassDeclaration } from 'typescript/unstable/ast'
import { isCallExpression }       from 'typescript/unstable/ast'
import { isClassDeclaration }     from 'typescript/unstable/ast'
import { isDecorator }            from 'typescript/unstable/ast'
import { isIdentifier }           from 'typescript/unstable/ast'
import { isImportDeclaration }    from 'typescript/unstable/ast'
import { isInterfaceDeclaration } from 'typescript/unstable/ast'
import { isNamedImports }         from 'typescript/unstable/ast'
import { isStringLiteral }        from 'typescript/unstable/ast'
import { type ModifierLike }      from 'typescript/unstable/ast'
import { type Node }              from 'typescript/unstable/ast'
import { type SourceFile }        from 'typescript/unstable/ast'
import { type Statement }         from 'typescript/unstable/ast'
import { SyntaxKind }             from 'typescript/unstable/ast'
import { TokenFlags }             from 'typescript/unstable/ast'
import * as factory               from 'typescript/unstable/ast/factory'

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

function usesDecoratorValues(node: ClassDeclaration)
{
	const mixins: string[] = []
	for (const decorator of node.modifiers?.filter(isDecorator) ?? []) {
		if (!isCallExpression(decorator.expression)) continue
		if (decorator.expression.expression.getText() !== 'Uses') continue
		for (const argument of decorator.expression.arguments) {
			if (!isIdentifier(argument)) continue
			mixins.push(argument.text)
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

		function visit(node: Node): void
		{
			if (isImportDeclaration(node) && node.importClause && isStringLiteral(node.moduleSpecifier)) {
				const importPath    = node.moduleSpecifier.text
				const namedBindings = node.importClause.namedBindings
				const name          = node.importClause.name
				if (name) {
					imports.set(name.text, { default: true, path: importPath })
				}
				if (namedBindings && isNamedImports(namedBindings)) {
					namedBindings.elements.forEach(element => {
						imports.set(element.name.text, { default: false, path: importPath })
					})
				}
			}

			if (isClassDeclaration(node)) {
				const className = node.name?.text
				const mixins    = usesDecoratorValues(node)
				if (className && mixins.length) {
					const isDefault = node.modifiers?.some(
						modifier => (modifier.kind === SyntaxKind.DefaultKeyword)
					)

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

			if (isInterfaceDeclaration(node)) {
				const className = node.name.text
				if (node.modifiers?.some(modifier => (modifier.kind === SyntaxKind.ExportKeyword))) {
					alreadyInterfaces.add(className)
					updateOptions.createInterfaces.delete(className)
				}
			}

			node.forEachChild(visit)
		}

		visit(sourceFile)
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
