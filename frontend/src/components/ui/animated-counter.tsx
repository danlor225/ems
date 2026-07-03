// ============================================================
//  AnimatedCounter — compteur qui s'anime de 0 à sa valeur.
//  Micro-interaction premium sur les KPIs.
// ============================================================
import { animate } from 'framer-motion'
import { useEffect, useState } from 'react'

export function AnimatedCounter({
  value,
  duration = 0.9,
}: {
  value: number
  duration?: number
}) {
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    const controls = animate(0, value, {
      duration,
      ease: 'easeOut',
      onUpdate: (v) => setDisplay(v),
    })
    return () => controls.stop()
  }, [value, duration])

  return <>{Math.round(display).toLocaleString('fr-FR')}</>
}
