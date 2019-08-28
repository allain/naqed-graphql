const Naqed = require('naqed')
const { STRING } = Naqed.types

const NaqedGraphQL = require('..')

function cleanTypeDef (str) {
  let indent = 0
  return (str || '')
    .trim()
    .split('\n')
    .map(line => {
      const trimmedLine = line.trim()
      if (!trimmedLine) return ''

      if (trimmedLine.startsWith('}')) {
        indent--
      }

      const newLine = '  '.repeat(indent) + trimmedLine
      if (newLine.endsWith('{')) indent++

      return newLine
    })
    .join('\n')
}

it('can create an executable graphql schema from an Naqed instance', async () => {
  const n = new Naqed({
    test: {
      $BOOL () {
        return true
      }
    }
  })

  const nql = new NaqedGraphQL(n)

  expect(nql).toBeDefined()

  expect(typeof nql.typeDefs).toEqual('string')
  expect(typeof nql.resolvers).toEqual('object')
})

it('exposes types defined at top level', () => {
  const nql = new NaqedGraphQL(
    new Naqed({
      $Test: {
        id: STRING,
        tags: [STRING]
      }
    })
  )

  expect(cleanTypeDef(nql.typeDefs)).toEqual(
    cleanTypeDef(`
    type Test {
      id: String
      tags: [String]
    }
    `)
  )
})

it('exposes queries on Query', () => {
  const nql = new NaqedGraphQL(
    new Naqed({
      test: {
        $STRING () {
          return 'HELLO'
        }
      }
    })
  )

  expect(cleanTypeDef(nql.typeDefs)).toEqual(
    cleanTypeDef(`
      type Query {
        test: String
      }
    `)
  )
})

it('exposes mutations on Mutation ', () => {
  const nql = new NaqedGraphQL(
    new Naqed({
      '~test': {
        $STRING ({ name: String }) {
          return `HELLO ${name}`
        },
        $name: STRING
      }
    })
  )

  expect(cleanTypeDef(nql.typeDefs)).toEqual(
    cleanTypeDef(`
      type Mutation {
        test(name: String): String
      }
    `)
  )
})

it('supports cyclic type definitions', () => {
  const nql = new NaqedGraphQL(
    new Naqed({
      $A: {
        name: STRING,
        b: {
          $B () {
            return {
              name: 'B'
            }
          }
        }
      },
      $B: {
        name: STRING,
        a: {
          $A () {
            return {
              name: 'A'
            }
          }
        }
      },

      root: {
        $A () {
          return { name: 'ROOT' }
        }
      }
    })
  )

  expect(cleanTypeDef(nql.typeDefs)).toEqual(
    cleanTypeDef(`
      type A {
        name: String
        b: B
      }

      type B {
        name: String
        a: A
      }

      type Query {
        root: A 
      }
    `)
  )
})

it('supports arrays of input types', () => {
  const nql = new NaqedGraphQL(
    new Naqed({
      $A: {
        name: STRING
      },
      '~CreateA': {
        $A ({ input }) {},
        $input: ['A']
      }
    })
  )

  expect(cleanTypeDef(nql.typeDefs)).toEqual(
    cleanTypeDef(`
  type A {
    name: String
  }

  input AInput {
    name: String
  }
  
  type Mutation {
    CreateA(input: [AInput]): A
  }`)
  )
})

it('autogenerates input when complex type is used as input', () => {
  const nql = new NaqedGraphQL(
    new Naqed({
      $A: {
        name: STRING,
        b: 'B'
      },

      $B: {
        name: STRING
      },

      '~CreateA': {
        $A ({ input }) {
          return { name: 'TEST' }
        },
        $input: 'A'
      }
    })
  )

  expect(cleanTypeDef(nql.typeDefs)).toEqual(
    cleanTypeDef(`
  type A {
    name: String
    b: B
  }

  type B {
    name: String
  }

  input AInput {
    name: String
    b: BInput
  }

  input BInput {
    name: String
  }
  
  type Mutation {
    CreateA(input: AInput): A
  }`)
  )
})
