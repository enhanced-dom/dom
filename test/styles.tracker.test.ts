import '@testing-library/jest-dom'
import { StylesTracker } from '../src'

function populateExampleDom() {
  document.head.innerHTML = `
    <style>
      .someparent .myclass {margin: 1px; border: none;}
      .myparent > .myclass {margin: 2px;}
      #myid > .myclass {margin: 3px;}
      .myclass #otherid {margin: 4px;}
      body .otherclass .myclass {margin: 5px;}
      .myclass { margin: 0px; }
      .myclass::hover { margin: 6px; }
    </style>
    <style>
    </style>
  `
}

describe('styles tracker', () => {
  beforeEach(populateExampleDom)

  test('gets correct class', () => {
    const tracker = new StylesTracker()
    const styles = tracker.getStyles('myclass')
    expect(styles).toContain('#otherid')
    const otherStyles = tracker.getStyles(['otherclass'])
    expect(otherStyles).toContain('body')
    const noRules = tracker.getStyles('thisclassdoesnotexist')
    expect(noRules).toEqual('')
  })

  test('tracks added style nodes', (done) => {
    const tracker = new StylesTracker()
    const stylesAddedLater = '.myclass {margin: 7px;}'
    const listener1 = jest.fn(() => {})
    const listener1Id = tracker.registerListener(listener1)
    let styles = tracker.getStyles('myclass', listener1Id)
    expect(styles).not.toContain(stylesAddedLater)
    expect(listener1).not.toBeCalled()
    const listener2 = jest.fn(() => {})
    const listener2Id = tracker.registerListener(listener2)
    tracker.getStyles('myotherclass', listener2Id)
    expect(listener2).not.toBeCalled()
    setTimeout(() => {
      const styleElement = document.createElement('style')
      styleElement.innerHTML = stylesAddedLater
      document.head.appendChild(styleElement)
      setTimeout(() => {
        expect(listener1).toBeCalled()
        expect(listener2).not.toBeCalled()
        styles = tracker.getStyles('myclass', listener1Id)
        expect(styles).toContain(stylesAddedLater)
        done()
      }, 5)
    }, 5)
  })

  test('tracks removed style nodes', (done) => {
    const stylesToRemove = '.myclass {margin: 7px;}'
    document.head.children[1].innerHTML = stylesToRemove
    const tracker = new StylesTracker()
    const listener1 = jest.fn(() => {})
    const listener1Id = tracker.registerListener(listener1)
    let styles = tracker.getStyles('myclass', listener1Id)
    expect(styles).toContain(stylesToRemove)
    expect(listener1).not.toBeCalled()
    const listener2 = jest.fn(() => {})
    const listener2Id = tracker.registerListener(listener2)
    tracker.getStyles('myotherclass', listener2Id)
    expect(listener2).not.toBeCalled()
    setTimeout(() => {
      document.head.removeChild(document.head.children[1])
      setTimeout(() => {
        expect(listener1).toBeCalled()
        expect(listener2).not.toBeCalled()
        styles = tracker.getStyles('myclass', listener1Id)
        expect(styles).not.toContain(stylesToRemove)
        done()
      }, 5)
    }, 5)
  })
})
