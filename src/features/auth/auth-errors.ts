export function translateAuthError(message: string): string {
  if (message.includes('Invalid login credentials')) return 'E-mail ou mot de passe incorrect.'
  if (message.includes('User already registered')) return 'Un compte existe déjà avec cet e-mail.'
  if (message.includes('duplicate key value') && message.includes('username')) {
    return 'Ce pseudo est déjà pris.'
  }
  if (message.includes('Password should be at least')) {
    return 'Le mot de passe doit faire au moins 8 caractères, avec une majuscule et un chiffre.'
  }
  if (message.includes('Email not confirmed')) {
    return 'Confirme ton adresse e-mail avant de te connecter (vérifie ta boîte mail).'
  }
  if (message.includes('rate limit')) return 'Trop de tentatives, réessaie dans quelques minutes.'
  return 'Une erreur est survenue. Réessaie dans un instant.'
}
