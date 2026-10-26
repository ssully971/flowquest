import { strings } from '@/shared/i18n'

import { LegalLayout } from '../components/LegalLayout'
import { LegalSectionBlock } from '../components/LegalSectionBlock'
import {
  DATA_CATEGORIES,
  PRIVACY_LAST_UPDATED,
  PRIVACY_SECTIONS,
  PRIVACY_TEXT,
  SUBPROCESSORS,
} from '../content/privacy-sections'

export function PrivacyPage() {
  return (
    <LegalLayout
      title={strings.legal.privacyTitle}
      lastUpdated={PRIVACY_LAST_UPDATED}
      sections={PRIVACY_SECTIONS}
    >
      <LegalSectionBlock id="qui" title="Qui nous sommes">
        <p>{PRIVACY_TEXT.qui}</p>
      </LegalSectionBlock>

      <LegalSectionBlock id="jamais" title="Ce que nous ne faisons jamais">
        <p>{PRIVACY_TEXT.jamais}</p>
      </LegalSectionBlock>

      <LegalSectionBlock id="donnees" title="Données que nous traitons">
        <p>{PRIVACY_TEXT.donneesIntro}</p>
        <ul className="list-disc pl-5">
          {DATA_CATEGORIES.map((category) => (
            <li key={category.label}>
              <strong>{category.label}</strong> : {category.detail}
            </li>
          ))}
        </ul>
      </LegalSectionBlock>

      <LegalSectionBlock id="finalites" title="Finalités et bases légales">
        <p>{PRIVACY_TEXT.finalitesIntro}</p>
        <ul className="list-disc pl-5">
          {PRIVACY_TEXT.finalites.map((item) => (
            <li key={item.title}>
              <strong>{item.title}</strong> : {item.detail}
            </li>
          ))}
        </ul>
      </LegalSectionBlock>

      <LegalSectionBlock id="sous-traitants" title="Sous-traitants">
        <p>{PRIVACY_TEXT.sousTraitantsIntro}</p>
        <ul className="list-disc pl-5">
          {SUBPROCESSORS.map((item) => (
            <li key={item.name}>
              <strong>{item.name}</strong> : {item.role}
            </li>
          ))}
        </ul>
      </LegalSectionBlock>

      <LegalSectionBlock id="conservation" title="Durée de conservation">
        <p>{PRIVACY_TEXT.conservation}</p>
      </LegalSectionBlock>

      <LegalSectionBlock id="cookies" title="Cookies et stockage local">
        <p>{PRIVACY_TEXT.cookiesIntro}</p>
      </LegalSectionBlock>

      <LegalSectionBlock id="transferts" title="Transferts hors Union européenne">
        <p>{PRIVACY_TEXT.transferts}</p>
      </LegalSectionBlock>

      <LegalSectionBlock id="droits" title="Tes droits">
        <p>{PRIVACY_TEXT.droitsIntro}</p>
        <ul className="list-disc pl-5">
          {PRIVACY_TEXT.droits.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p>{PRIVACY_TEXT.droitsAutres}</p>
      </LegalSectionBlock>

      <LegalSectionBlock id="administration" title="Consultation par l’administrateur">
        <p>{PRIVACY_TEXT.administration}</p>
      </LegalSectionBlock>

      <LegalSectionBlock id="securite" title="Sécurité">
        <p>{PRIVACY_TEXT.securite}</p>
      </LegalSectionBlock>

      <LegalSectionBlock id="modifications" title="Modifications de cette politique">
        <p>{PRIVACY_TEXT.modifications}</p>
      </LegalSectionBlock>

      <LegalSectionBlock id="contact" title="Contact et réclamation">
        <p>{PRIVACY_TEXT.contact}</p>
      </LegalSectionBlock>
    </LegalLayout>
  )
}
