import { supabase } from '@/shared/supabase/client'

export interface SendSupportMessageResult {
  ok: boolean
}

/**
 * Enregistre un message de support en base (§7.8 du cahier des charges). Aucune file
 * d'attente hors ligne ici : contrairement aux réglages/tâches/notes, ce n'est pas un état
 * local-first à resynchroniser, mais un envoi ponctuel — en cas d'échec, l'appelant garde
 * le texte saisi et peut réessayer.
 */
export async function sendSupportMessage(
  email: string,
  body: string,
  userId: string | null,
): Promise<SendSupportMessageResult> {
  if (!supabase) return { ok: false }

  const { error } = await supabase.from('support_messages').insert({ email, body, user_id: userId })

  return { ok: !error }
}
