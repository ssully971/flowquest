import { strings } from '@/shared/i18n'

import { LegalLayout } from '../components/LegalLayout'
import { LegalSectionBlock } from '../components/LegalSectionBlock'
import { NOTICE_LAST_UPDATED, NOTICE_SECTIONS } from '../content/notice-sections'

export function LegalNoticePage() {
  return (
    <LegalLayout
      title={strings.legal.noticeTitle}
      lastUpdated={NOTICE_LAST_UPDATED}
      sections={NOTICE_SECTIONS}
    >
      <LegalSectionBlock id="editeur" title="Éditeur">
        <p>
          {strings.app.name} est édité par Sullivan Huriez, 616 Rue de Patay, Huisseau-sur-Mauves,
          France.
        </p>
        <p>Contact : sullivanhuriez@gmail.com</p>
      </LegalSectionBlock>

      <LegalSectionBlock id="publication" title="Directeur de la publication">
        <p>Directeur de la publication : Sullivan Huriez.</p>
      </LegalSectionBlock>

      <LegalSectionBlock id="hebergement" title="Hébergement">
        <p>L'application elle-même est hébergée par :</p>
        <p>
          Vercel Inc.
          <br />
          440 N Barranca Ave #4133, Covina, CA 91723, États-Unis
          <br />
          <a
            href="https://vercel.com"
            className="text-[var(--accent)] underline-offset-2 hover:underline"
          >
            https://vercel.com
          </a>
        </p>
        <p>
          La base de données, l'authentification et le stockage des fichiers sont hébergés par :
        </p>
        <p>
          Supabase Pte. Ltd.
          <br />
          65 Chulia Street #38-02/03, OCBC Centre, Singapore 049513, Singapour
          <br />
          legal@supabase.com
          <br />
          <a
            href="https://supabase.com"
            className="text-[var(--accent)] underline-offset-2 hover:underline"
          >
            https://supabase.com
          </a>
        </p>
      </LegalSectionBlock>

      <LegalSectionBlock id="contact" title="Contact">
        <p>Pour toute question : sullivanhuriez@gmail.com</p>
      </LegalSectionBlock>
    </LegalLayout>
  )
}
