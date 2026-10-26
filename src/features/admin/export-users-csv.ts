import type { AdminUserExportRow } from '@/shared/supabase/database.types'

const CSV_BOM = '﻿'
const HEADER = [
  'E-mail',
  'Pseudo',
  "Date d'inscription",
  'Dernière activité',
  'Consentement newsletter',
]

function escapeCsvField(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

function formatDate(iso: string | null): string {
  return iso ? iso.slice(0, 10) : ''
}

/**
 * Génère un CSV UTF-8 avec BOM (nécessaire pour qu'Excel détecte correctement
 * l'encodage et affiche les accents sans caractères corrompus — sans BOM, Excel
 * suppose souvent du Windows-1252).
 */
export function buildUsersCsv(rows: AdminUserExportRow[]): string {
  const lines = [HEADER.join(',')]
  for (const row of rows) {
    lines.push(
      [
        escapeCsvField(row.email),
        escapeCsvField(row.username),
        formatDate(row.created_at),
        formatDate(row.last_active_at),
        row.marketing_consent ? 'Oui' : 'Non',
      ].join(','),
    )
  }
  return CSV_BOM + lines.join('\n')
}

/** Déclenche le téléchargement du CSV dans le navigateur — jamais d'appel réseau, le
 * fichier est entièrement construit côté client à partir des lignes déjà reçues. */
export function downloadUsersCsv(rows: AdminUserExportRow[], filename: string): void {
  const csv = buildUsersCsv(rows)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
