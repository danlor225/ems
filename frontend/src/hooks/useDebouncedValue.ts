// ============================================================
//  useDebouncedValue — retarde la propagation d'une valeur.
//  Utile pour la recherche instantanée (évite une requête par frappe).
// ============================================================
import { useEffect, useState } from 'react'

export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return debounced
}
