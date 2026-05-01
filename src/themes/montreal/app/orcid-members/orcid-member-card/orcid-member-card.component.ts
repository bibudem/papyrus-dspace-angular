import { NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { OrcidMember } from '../orcid-public-api.service';

/**
 * Carte de présentation d'un chercheur UdeM enregistré sur ORCID.
 * Composant purement présentationnel : reçoit un `OrcidMember` en entrée
 * et n'a aucune dépendance sur les services métier.
 */
@Component({
  selector: 'ds-orcid-member-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIf, RouterLink, TranslateModule],
  templateUrl: './orcid-member-card.component.html',
  styleUrls: ['./orcid-member-card.component.scss'],
})
export class OrcidMemberCardComponent {
  /** Données du chercheur à afficher, fournies par le composant parent. */
  @Input({ required: true }) member!: OrcidMember;

  /**
   * Nom d'affichage calculé selon l'ordre de priorité ORCID :
   *  1. `credit-name` (nom préféré déclaré par le chercheur)
   *  2. Prénom + nom de famille
   *  3. Identifiant ORCID brut (repli si le profil est incomplet)
   */
  get displayName(): string {
    const name =
      this.member.creditName ??
      [this.member.givenName, this.member.familyName].filter(Boolean).join(' ');
    return name || this.member.orcidId;
  }

  /**
   * Extrait de biographie limité à 220 caractères.
   * Retourne `undefined` si aucune biographie n'est disponible,
   * ce qui masque le paragraphe dans le template via `*ngIf`.
   */
  get biographyExcerpt(): string | undefined {
    const bio = this.member.biography;
    if (!bio) {
      return undefined;
    }
    return bio.length > 220 ? `${bio.slice(0, 220)}…` : bio;
  }
}
