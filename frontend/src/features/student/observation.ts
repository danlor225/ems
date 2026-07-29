// ============================================================
//  Observation pédagogique dérivée de la note (en %).
//  Purement calculée à partir du score : aucune donnée serveur
//  supplémentaire n'est nécessaire.
// ============================================================
import type { BadgeProps } from '@/components/ui/badge'

export interface Observation {
  label: string
  message: string
  // Réutilise les variantes sémantiques du Badge (success/info/warning/danger).
  tone: NonNullable<BadgeProps['variant']>
}

// Bandes de notes → appréciation + conseil. Les seuils sont volontairement
// simples et ajustables ici (source unique de vérité).
export function getObservation(percentage: number): Observation {
  if (percentage >= 90) {
    return {
      label: 'Excellent',
      tone: 'success',
      message:
        'Maîtrise remarquable du sujet. Continuez sur cette lancée !',
    }
  }
  if (percentage >= 80) {
    return {
      label: 'Très bien',
      tone: 'success',
      message: 'Très bon travail, vous maîtrisez bien la matière.',
    }
  }
  if (percentage >= 70) {
    return {
      label: 'Bien',
      tone: 'success',
      message: 'Bon résultat. Encore quelques points à consolider.',
    }
  }
  if (percentage >= 60) {
    return {
      label: 'Assez bien',
      tone: 'info',
      message:
        'Résultat correct. Revoyez les notions les moins bien réussies.',
    }
  }
  if (percentage >= 50) {
    return {
      label: 'Passable',
      tone: 'warning',
      message:
        'Vous avez la moyenne, mais certaines bases restent à renforcer.',
    }
  }
  return {
    label: 'Insuffisant',
    tone: 'danger',
    message:
      'Un travail de révision approfondi est nécessaire. N’hésitez pas à solliciter votre enseignant.',
  }
}
