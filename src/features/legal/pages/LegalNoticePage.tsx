import { strings } from '@/shared/i18n'

import { LegalLayout } from '../components/LegalLayout'
import { LegalSectionBlock } from '../components/LegalSectionBlock'
import { ToComplete } from '../components/ToComplete'
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
          {strings.app.name} est édité par <ToComplete hint="raison sociale ou nom de l’éditeur" />,{' '}
          <ToComplete hint="adresse postale de l’éditeur ou, pour une personne physique, adresse de contact" />
          .
        </p>
      </LegalSectionBlock>

      <LegalSectionBlock id="publication" title="Directeur de la publication">
        <p>
          Directeur de la publication : <ToComplete hint="nom du directeur de la publication" />.
        </p>
      </LegalSectionBlock>

      <LegalSectionBlock id="hebergement" title="Hébergement">
        <p>L'application elle-même est hébergée par :</p>
        <p>
          Vercel Inc. —{' '}
          <ToComplete hint="adresse et coordonnées exactes de cet hébergeur à cette date" />
        </p>
        <p>
          La base de données, l'authentification et le stockage des fichiers sont hébergés par :
        </p>
        <p>
          Supabase Inc. —{' '}
          <ToComplete hint="adresse et coordonnées exactes de cet hébergeur à cette date" />
        </p>
      </LegalSectionBlock>

      <LegalSectionBlock id="contact" title="Contact">
        <p>Pour toute question : flowquestt@gmail.com</p>
      </LegalSectionBlock>
    </LegalLayout>
  )
}
