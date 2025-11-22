/* global jest, expect, test, describe */
import '@testing-library/jest-dom'
import { HtmlRenderer, SECTION_ID, WithManagedEvents, type IAbstractNode } from '../src'

describe('html renderer', () => {
  test('non-element', () => {
    const ast1 = {
      content: 'aaa',
    }

    const renderer = new HtmlRenderer()
    const div = document.createElement('div')
    renderer.render(div, null)

    expect(div.innerHTML).toEqual('')

    renderer.render(div, ast1)

    expect(div.innerHTML).toEqual('aaa')
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

    const renderer = new HtmlRenderer()
    const div = document.createElement('div')
    renderer.render(div, ast1)

    expect(div.innerHTML).toEqual(`<span ${SECTION_ID}="aaa"></span>`)

    renderer.render(div, ast2)

    expect(div.innerHTML).toEqual(`<div ${SECTION_ID}="aaa"></div>`)
  })

  test('identical elements', () => {
    const ast1 = {
      tag: 'span',
      attributes: {
        [SECTION_ID]: 'aaa',
      },
    }

    const renderer = new HtmlRenderer()
    const div = document.createElement('div')
    renderer.render(div, ast1)

    expect(div.innerHTML).toEqual(`<span ${SECTION_ID}="aaa"></span>`)
    const span = div.querySelector('span')
    div.removeChild(span) // we remove child, but we don't tell the renderer we've removed it

    renderer.render(div, ast1)
    expect(div.innerHTML).toEqual(`<span ${SECTION_ID}="aaa"></span>`) // new node was created again
  })

  test('matching elements - no children', () => {
    const ast1 = {
      tag: 'span',
      attributes: {
        [SECTION_ID]: 'aaa',
        toRemove: { lala: null },
        toModify: true,
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

    const renderer = new HtmlRenderer()
    const div = document.createElement('div')
    renderer.render(div, ast1)
    expect(div.innerHTML).toEqual(`<span ${SECTION_ID}="aaa" toremove="{&quot;lala&quot;:null}" tomodify="" toignore="3"></span>`)
    const span = div.querySelector('span')
    span.setAttribute('test', 'should-remove-even-if-not-in-original-ast')
    renderer.render(div, ast2)
    expect(div.innerHTML).toEqual(`<span ${SECTION_ID}="aaa" tomodify="5" toignore="3" toadd="4"></span>`)
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

    const renderer = new HtmlRenderer()
    const div = document.createElement('div')
    renderer.render(div, ast1)
    expect(div.innerHTML).toEqual('<span><div></div><span width="3"></span><slot name="aaa"></slot>3</span>')
    const span = div.querySelector('span')
    span.setAttribute('test', 'should-not-do-complete-rerender')
    const slot = span.querySelector('slot')
    slot.setAttribute('test', 'should-not-do-complete-rerender')
    renderer.render(div, ast2)
    expect(div.innerHTML).toEqual(
      '<span>AA<span width="20"></span><div></div><div height="5"></div><slot name="aaa" color="blue"></slot></span>',
    )
  })

  test('matching elements - with listeners', () => {
    const focusHandler = jest.fn()
    const clickHandler = jest.fn()
    const otherClickHandler = jest.fn()
    const ast1: IAbstractNode = {
      tag: 'span',
      eventListeners: {
        click: clickHandler,
      },
      children: [
        {
          tag: 'div',
          eventListeners: {
            focus: focusHandler,
          },
        },
      ],
    }

    const ast2: IAbstractNode = {
      tag: 'span',
      children: [
        {
          tag: 'div',
          eventListeners: {
            focus: focusHandler,
            click: otherClickHandler,
          },
        },
      ],
    }

    const renderer = new HtmlRenderer()
    const div = document.createElement('div')
    renderer.render(div, ast1)
    let span = div.querySelector('span') as WithManagedEvents<HTMLSpanElement>
    // check the event listeners on the span element have been registered both on the node and as listeners
    expect(span._managedEventListeners).not.toBe(undefined)
    expect(span._managedEventListeners['click']).toEqual(clickHandler)
    span.click()
    expect(clickHandler).toHaveBeenCalled()

    // check the event listeners on the inner div element have been registered both on the node and as listeners
    let innerDiv = span.querySelector('div') as WithManagedEvents<HTMLDivElement>
    expect(innerDiv._managedEventListeners).not.toBe(undefined)
    expect(innerDiv._managedEventListeners['focus']).toEqual(focusHandler)
    innerDiv.dispatchEvent(new Event('focus')) // innerDiv.focus() does not have the same effect
    expect(focusHandler).toHaveBeenCalled()

    // reset handlers
    clickHandler.mockReset()
    focusHandler.mockReset()
    expect(clickHandler).not.toHaveBeenCalled()
    expect(focusHandler).not.toHaveBeenCalled()

    renderer.render(div, ast2)

    // check the lack of a click handler on the span + the old listener should no longer react
    span = div.querySelector('span') as WithManagedEvents<HTMLSpanElement>
    expect(span._managedEventListeners?.['click']).toEqual(undefined)
    span.click()
    expect(clickHandler).not.toHaveBeenCalled()

    // check the focus listener still exists on the inner div, and it still reacts
    innerDiv = span.querySelector('div') as WithManagedEvents<HTMLDivElement>
    expect(innerDiv._managedEventListeners['focus']).toEqual(focusHandler)
    expect(innerDiv._managedEventListeners['click']).toEqual(otherClickHandler) // check other event handlers have been added
    innerDiv.dispatchEvent(new Event('focus'))
    expect(focusHandler).toHaveBeenCalled()
    innerDiv.click()
    expect(otherClickHandler).toHaveBeenCalled()
  })
})
