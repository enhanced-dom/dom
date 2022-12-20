import '@testing-library/jest-dom'
import { AbstractDomDiff, SECTION_ID, type IAbstractNode, AbstractDomOperationType } from '../src'

describe('abstract dom diff', () => {
  test('non-element vs element', () => {
    const ast1 = {
      content: 'aaa',
    }

    const ast2 = {
      tag: 'div',
    }

    const diff = new AbstractDomDiff()
    let result = diff.diff(ast1, null)
    expect(result.length).toEqual(1)
    expect(result[0]).toEqual({ path: '', type: AbstractDomOperationType.ADD, data: ast1 })

    result = diff.diff(ast2, ast1)
    expect(result.length).toEqual(1)
    expect(result[0]).toEqual({ path: '', type: AbstractDomOperationType.REPLACE, data: ast2 })

    result = diff.diff(ast1, ast2)
    expect(result.length).toEqual(1)
    expect(result[0]).toEqual({ path: '', type: AbstractDomOperationType.REPLACE, data: ast1 })

    result = diff.diff(null, ast1)
    expect(result.length).toEqual(1)
    expect(result[0]).toEqual({ path: '', type: AbstractDomOperationType.REMOVE })
  })

  test('non-matching elements', () => {
    const ast1 = {
      tag: 'span',
      attributes: {
        [SECTION_ID]: 'aaa',
      },
    }

    const ast2 = {
      tag: 'div',
      attributes: {
        [SECTION_ID]: 'aaa',
      },
    }

    const diff = new AbstractDomDiff()
    const result = diff.diff(ast2, ast1)
    expect(result.length).toEqual(1)
    expect(result[0]).toEqual({ path: '', type: AbstractDomOperationType.REPLACE, data: ast2 })
  })

  test('identical elements', () => {
    const ast1 = {
      tag: 'span',
      attributes: {
        [SECTION_ID]: 'aaa',
      },
    }

    const ast2 = {
      content: 'aa',
    }

    const diff = new AbstractDomDiff()
    let result = diff.diff(ast1, ast1)
    expect(result.length).toEqual(0)

    result = diff.diff(ast2, ast2)
    expect(result.length).toEqual(0)
  })

  test('matching elements - no children', () => {
    const ast1 = {
      tag: 'span',
      attributes: {
        [SECTION_ID]: 'aaa',
        toRemove: 1,
        toModify: 2,
        toIgnore: 3,
      },
    }

    const ast2 = {
      tag: 'span',
      attributes: {
        [SECTION_ID]: 'aaa',
        toModify: 5,
        toIgnore: 3,
        toAdd: 4,
      },
    }

    const diff = new AbstractDomDiff()
    const result = diff.diff(ast2, ast1)
    expect(result.length).toEqual(3)
    expect(result.find((r) => r.path === '.toModify')).toEqual({ path: '.toModify', type: AbstractDomOperationType.MODIFY, data: 5 })
    expect(result.find((r) => r.path === '.toAdd')).toEqual({ path: '.toAdd', type: AbstractDomOperationType.MODIFY, data: 4 })
    expect(result.find((r) => r.path === '.toRemove')).toEqual({ path: '.toRemove', type: AbstractDomOperationType.MODIFY, data: null })
  })

  test('matching elements - with children', () => {
    const ast1: IAbstractNode = {
      tag: 'span',
      children: [
        {
          tag: 'div',
        },
        {
          tag: 'span',
          attributes: {
            width: 3,
          },
        },
        {
          tag: 'slot',
          attributes: {
            name: 'aaa',
          },
        },
        {
          content: 3,
        },
      ],
    }

    const ast2: IAbstractNode = {
      tag: 'span',
      children: [
        {
          content: 'AA',
        },
        {
          tag: 'span',
          attributes: {
            width: 20,
          },
        },
        {
          tag: 'div',
          attributes: {
            height: 5,
          },
        },
        {
          tag: 'div',
        },
        {
          tag: 'slot',
          attributes: {
            name: 'aaa',
            color: 'blue',
          },
        },
      ],
    }

    const diff = new AbstractDomDiff()
    const result = diff.diff(ast2, ast1)
    expect(result.length).toEqual(7)
    expect(result[0]).toEqual({ path: '/children#0.height', type: AbstractDomOperationType.MODIFY, data: 5 })
    expect(result[1]).toEqual({ path: '/children#1.width', type: AbstractDomOperationType.MODIFY, data: 20 })
    expect(result[2]).toEqual({ path: '/children#2.color', type: AbstractDomOperationType.MODIFY, data: 'blue' })
    expect(result[3]).toEqual({ path: '/children#3', type: AbstractDomOperationType.REMOVE })
    expect(result[4]).toEqual({ path: '/children#0', type: AbstractDomOperationType.INSERT, data: ast2.children[3] })
    expect(result[5]).toEqual({ path: '/children#0', type: AbstractDomOperationType.INSERT, data: ast2.children[0] })
    expect(result[6]).toEqual({ path: '/children#3', type: AbstractDomOperationType.MOVE, data: 1 })
  })

  test('matching elements - null children', () => {
    const ast1: IAbstractNode = {
      tag: 'span',
      children: [
        {
          content: 3,
        },
      ],
    }

    const ast2: IAbstractNode = {
      tag: 'span',
      children: [],
    }

    const ast3: IAbstractNode = {
      tag: 'span',
      children: [null, null],
    }

    const diff = new AbstractDomDiff()
    let result = diff.diff(ast2, ast1)
    expect(result.length).toEqual(1)
    expect(result[0]).toEqual({ path: '/children', type: AbstractDomOperationType.REMOVE })

    result = diff.diff(ast3, ast1)
    expect(result.length).toEqual(1)
    expect(result[0]).toEqual({ path: '/children', type: AbstractDomOperationType.REMOVE })
  })
})
