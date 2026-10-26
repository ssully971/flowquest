import { strings } from '@/shared/i18n'

import { LegalLayout } from '../components/LegalLayout'
import { LegalSectionBlock } from '../components/LegalSectionBlock'
import { TERMS_LAST_UPDATED, TERMS_SECTIONS, TERMS_TEXT } from '../content/terms-sections'

export function TermsPage() {
  return (
    <LegalLayout
      title={strings.legal.termsTitle}
      lastUpdated={TERMS_LAST_UPDATED}
      sections={TERMS_SECTIONS}
    >
      <LegalSectionBlock id="objet" title="Objet et acceptation">
        <p>{TERMS_TEXT.objet}</p>
      </LegalSectionBlock>

      <LegalSectionBlock id="admissibilite" title="Admissibilité et âge minimum">
        <p>{TERMS_TEXT.admissibilite}</p>
      </LegalSectionBlock>

      <LegalSectionBlock id="compte" title="Création et gestion de compte">
        <p>{TERMS_TEXT.compte}</p>
      </LegalSectionBlock>

      <LegalSectionBlock id="usage" title="Usage autorisé">
        <p>{TERMS_TEXT.usage}</p>
      </LegalSectionBlock>

      <LegalSectionBlock id="interdictions" title="Ce que tu ne dois pas faire">
        <p>En utilisant {strings.app.name}, tu t'engages à ne pas :</p>
        <ul className="list-disc pl-5">
          {TERMS_TEXT.interdictions.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </LegalSectionBlock>

      <LegalSectionBlock id="contenu" title="Normes de contenu">
        <p>{TERMS_TEXT.contenu}</p>
      </LegalSectionBlock>

      <LegalSectionBlock id="moderation" title="Modération et droit de retrait">
        <p>{TERMS_TEXT.moderation}</p>
      </LegalSectionBlock>

      <LegalSectionBlock id="notifications" title="Notifications par e-mail">
        <p>{TERMS_TEXT.notifications}</p>
      </LegalSectionBlock>

      <LegalSectionBlock id="propriete" title="Propriété intellectuelle">
        <p>{TERMS_TEXT.propriete}</p>
      </LegalSectionBlock>

      <LegalSectionBlock id="evolutions" title="Évolutions du service">
        <p>{TERMS_TEXT.evolutions}</p>
      </LegalSectionBlock>

      <LegalSectionBlock id="garantie" title="Absence de garantie">
        <p>{TERMS_TEXT.garantie}</p>
      </LegalSectionBlock>

      <LegalSectionBlock id="securite" title="Sécurité des données">
        <p>{TERMS_TEXT.securite}</p>
      </LegalSectionBlock>

      <LegalSectionBlock id="resiliation" title="Résiliation">
        <p>{TERMS_TEXT.resiliation}</p>
      </LegalSectionBlock>

      <LegalSectionBlock id="droit" title="Droit applicable et litiges">
        <p>{TERMS_TEXT.droit}</p>
      </LegalSectionBlock>

      <LegalSectionBlock id="contact" title="Contact">
        <p>{TERMS_TEXT.contact}</p>
      </LegalSectionBlock>
    </LegalLayout>
  )
}
