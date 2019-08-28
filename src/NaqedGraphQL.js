module.exports = class NaqedGraphQL {
  constructor (n) {
    this._n = n
  }

  get typeDefs () {
    const customTypeDefs = Object.entries(this._n.customTypes).map(
      ([name, spec]) => typeDefFromCustomType(name, spec)
    )

    const queryTypes = Object.entries(this._n.spec)
      .filter(([name, spec]) => !name.startsWith('~'))
      .map(([name, spec]) => toResolverType(name, spec))

    const queryType = queryTypes.length
      ? `type Query {
      ${queryTypes.join('\n')}
    }`
      : ''

    const mutationInputTypeNames = [
      ...Object.entries(this._n.spec)
        .filter(([name]) => name.startsWith('~'))
        .reduce((result, [_, spec]) => {
          const argTypes = Object.entries(spec)
            .filter(([name]) => name.match(/^\$[a-z]/))
            .map(([_, argSpec]) => extractTypeName(argSpec))
            .filter(name => {
              if (name.match(/^\[/)) {
                return this._n.customTypes[name.substr(1, name.length - 2)]
              } else {
                return this._n.customTypes[name]
              }
            })

          for (const argType of argTypes) {
            if (argType.startsWith('[')) {
              result.add(argType.substr(1, argType.length - 2) + 'Input')
            } else {
              result.add(argType + 'Input')
            }
          }

          return result
        }, new Set())
    ]

    const toGenerateTypes = [...mutationInputTypeNames]
    const inputTypeMap = {}
    while (toGenerateTypes.length) {
      const toGenerateType = toGenerateTypes.shift()
      // Already generated
      if (inputTypeMap[toGenerateTypes]) continue

      const { def, refs } = inputTypeFromCustomType(
        toGenerateType,
        this._n.customTypes[toGenerateType.replace(/Input$/, '')]
      )

      inputTypeMap[toGenerateType] = def
      refs.forEach(ref => toGenerateTypes.push(ref))
    }

    const inputTypes = Object.values(inputTypeMap)

    const mutationTypes = Object.entries(this._n.spec)
      .filter(([name]) => name.startsWith('~'))
      .map(([name, spec]) => toResolverType(name.substr(1), spec))

    const mutationType = mutationTypes.length
      ? `type Mutation {
      ${mutationTypes.join('\n')}
    }`
      : ''

    return [...customTypeDefs, ...inputTypes, queryType, mutationType]
      .filter(Boolean)
      .join('\n\n')
  }

  get resolvers () {
    return {}
  }
}

function toResolverType (name, spec) {
  const resultType = extractTypeName(spec)
  const argTypes = Object.entries(spec)
    .filter(([name]) => name.match(/^\$[a-z]/))
    .map(
      ([name, argSpec]) => `${name.substr(1)}: ${extractArgTypeName(argSpec)}`
    )
    .join(', ')

  return `${name}${argTypes ? `(${argTypes})` : ''}: ${resultType}`
}

function typeDefFromCustomType (name, spec) {
  return `type ${name} {
    ${Object.entries(spec)
    .map(([name, spec]) => {
      return `${name}: ${extractTypeName(spec)}`
    })
    .join('\n')}    
    }`
}

function inputTypeFromCustomType (name, spec) {
  const refs = new Set()

  const def = `input ${name} {
    ${Object.entries(spec)
    .map(([name, spec]) => {
      const argTypeName = extractArgTypeName(spec)
      if (argTypeName.match(/Input$/)) {
        refs.add(argTypeName)
      } else if (argTypeName.match(/Input\]$/)) {
        refs.add(argTypeName.substr(1, argTypeName.length - 2))
      }
      return `${name}: ${argTypeName}`
    })
    .join('\n')}    
    }`

  return { def, refs: [...refs] }
}

function extractArgTypeName (spec) {
  if (Array.isArray(spec)) {
    return '[' + extractArgTypeName(spec[0]) + ']'
  }
  if (typeof spec === 'string') return spec + 'Input'
  if (spec.name) return toGraphQLTypeName(spec.name)

  // must be a dynamic object now
  const typeName = Object.keys(spec).find(name => name.match(/^\$[A-Z]/))

  return toGraphQLTypeName(typeName) + 'Input'
}

function extractTypeName (spec) {
  if (Array.isArray(spec)) {
    return '[' + extractTypeName(spec[0]) + ']'
  }
  if (typeof spec === 'string') return spec
  if (spec.name) return toGraphQLTypeName(spec.name)

  // must be a dynamic object now
  const typeName = Object.keys(spec).find(name => name.match(/^\$[A-Z]/))

  return toGraphQLTypeName(typeName)
}

function toGraphQLTypeName (name) {
  if (name.startsWith('$')) name = name.substr(1)

  switch (name) {
    case 'BOOL':
      return 'Boolean'
    case 'ID':
      return 'ID'
    case 'STRING':
      return 'String'
    case 'FLOAT':
      return 'Float'
    case 'INT':
      return 'INT'
    default:
      return name
  }
}
