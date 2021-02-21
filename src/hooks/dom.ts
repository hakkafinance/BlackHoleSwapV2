import {
  useCallback,
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
} from 'react'

// modified from https://usehooks.com/useDebounce/
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    // Update debounced value after delay
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    // Cancel the timeout if value changes (also on delay change or unmount)
    // This is how we prevent debounced value from updating if value is changed ...
    // .. within the delay period. Timeout gets cleared and restarted.
    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

// modified from https://usehooks.com/useKeyPress/
export function useBodyKeyDown(
  targetKey: string,
  onKeyDown: () => void,
  suppressOnKeyDown: boolean = false,
): void {
  const downHandler = useCallback(
    (event) => {
      const {
        target: { tagName },
        key,
      } = event
      if (key === targetKey && tagName === 'BODY' && !suppressOnKeyDown) {
        event.preventDefault()
        onKeyDown()
      }
    },
    [targetKey, onKeyDown, suppressOnKeyDown],
  )

  useEffect(() => {
    window.addEventListener('keydown', downHandler)
    return () => {
      window.removeEventListener('keydown', downHandler)
    }
  }, [downHandler])
}

export function useClickOutside(handler: any, scopeElement: any) {
  const ref = useRef(null)
  const handlerRef = useRef(handler)

  useLayoutEffect(() => {
    handlerRef.current = handler
  })

  const escapeListener = useCallback((e) => {
    if (ref.current && e.key === 'Escape') {
      handlerRef.current()
    }
  }, [])

  const clickListener = useCallback((e) => {
    if (ref.current && !ref.current.contains(e.target)) {
      handlerRef.current()
    }
  }, [])

  useEffect(() => {
    if (window) {
      const scope = scopeElement || window.document
      scope.addEventListener('mousedown', clickListener)
      scope.addEventListener('touchstart', clickListener, { passive: true })
      scope.addEventListener('keyup', escapeListener)

      return () => {
        scope.removeEventListener('mousedown', clickListener)
        scope.removeEventListener('touchstart', clickListener, {
          passive: true,
        })
        scope.removeEventListener('keyup', escapeListener)
      }
    }
  }, [clickListener, escapeListener, scopeElement])

  return ref
}
