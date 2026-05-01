import { AsyncPipe, NgFor, NgIf, SlicePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';
import { catchError, map, startWith, switchMap } from 'rxjs/operators';

import {
  OrcidResearcherProfile,
  OrcidPublicApiService,
  OrcidWork,
} from '../orcid-public-api.service';

// ── Modèle de vue ────────────────────────────────────────────────────────────

interface ProfileViewModel {
  status: 'loading' | 'loaded' | 'error';
  profile: OrcidResearcherProfile | null;
}

// ── Types de publications — badge et couleur ──────────────────────────────────

/** Types de travaux ORCID reconnus pour l'affichage des badges. */
const WORK_TYPE_CSS: Record<string, string> = {
  'journal-article': 'badge-article',
  'book': 'badge-book',
  'book-chapter': 'badge-book',
  'conference-paper': 'badge-conference',
  'dissertation-thesis': 'badge-thesis',
  'report': 'badge-report',
  'preprint': 'badge-preprint',
};

// ── Composant ────────────────────────────────────────────────────────────────

/**
 * Page de profil détaillé d'un chercheur UdeM enregistré sur ORCID.
 * Thème Montréal — fonctionnalité propre à Papyrus.
 *
 * Affiche : identité, affiliations, mots-clés, biographie et liste de publications.
 * L'identifiant ORCID est lu dans les paramètres de la route `:orcidId`.
 */
@Component({
  selector: 'ds-orcid-researcher-profile',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncPipe, NgFor, NgIf, RouterLink, SlicePipe, TranslateModule],
  templateUrl: './orcid-researcher-profile.component.html',
  styleUrls: ['./orcid-researcher-profile.component.scss'],
})
export class OrcidResearcherProfileComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(OrcidPublicApiService);

  /**
   * Observable unique transmis au template via AsyncPipe.
   * La séquence pour chaque navigation est :
   *   loading (startWith) → loaded (succès) | error (catchError)
   */
  readonly vm$: Observable<ProfileViewModel>;

  constructor() {
    this.vm$ = this.route.paramMap.pipe(
      // Extraction de l'identifiant ORCID depuis l'URL (/orcid-members/:orcidId)
      map((params) => params.get('orcidId') ?? ''),
      switchMap((orcidId) =>
        this.service.getResearcherProfile(orcidId).pipe(
          map((profile) => ({ status: 'loaded' as const, profile })),
          catchError((err) => {
            console.error('[ORCID] Erreur de chargement du profil', err);
            return of({ status: 'error' as const, profile: null });
          }),
          startWith({ status: 'loading' as const, profile: null }),
        ),
      ),
      takeUntilDestroyed(),
    );
  }

  // ── Getters de présentation ───────────────────────────────────────────────

  /** Nom d'affichage selon la priorité ORCID : credit-name > prénom+nom > ID. */
  displayName(p: OrcidResearcherProfile): string {
    return (
      (p.creditName ?? [p.givenName, p.familyName].filter(Boolean).join(' ')) ||
      p.orcidId
    );
  }

  /** Initiales pour l'avatar généré (première lettre du prénom + du nom). */
  initials(p: OrcidResearcherProfile): string {
    return ([p.givenName[0], p.familyName[0]].filter(Boolean).join('').toUpperCase()) || '?';
  }

  /** Clé i18n du type de publication pour ngx-translate. */
  workTypeKey(type: string): string {
    const known = new Set(Object.keys(WORK_TYPE_CSS));
    return `papyrus.orcid-profile.work-type.${known.has(type) ? type : 'other'}`;
  }

  /** Classe CSS du badge de type de publication. */
  workTypeClass(type: string): string {
    return WORK_TYPE_CSS[type] ?? 'badge-other';
  }

  /** Fonction d'identité pour `*ngFor` sur les publications. */
  trackByPutCode(_index: number, work: OrcidWork): number {
    return work.putCode;
  }
}
