import { AsyncPipe, NgFor, NgIf, SlicePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, Input, OnInit } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { Observable, EMPTY } from 'rxjs';
import { catchError, map, startWith } from 'rxjs/operators';

import { Item } from '../../../../../app/core/shared/item.model';
import {
  OrcidPublicApiService,
  OrcidResearcherProfile,
  OrcidWork,
} from '../orcid-public-api.service';

// ── Constantes ────────────────────────────────────────────────────────────────

/** Préfixe des clés i18n pour les types de travaux. */
const WORK_TYPE_I18N_PREFIX = 'papyrus.orcid-profile.work-type.';

/** Map type ORCID → classe CSS du badge. */
const WORK_TYPE_CSS: Readonly<Record<string, string>> = {
  'journal-article':    'badge-article',
  'book':               'badge-book',
  'book-chapter':       'badge-book',
  'conference-paper':   'badge-conference',
  'dissertation-thesis':'badge-thesis',
  'report':             'badge-report',
  'preprint':           'badge-preprint',
};

const KNOWN_WORK_TYPES = new Set(Object.keys(WORK_TYPE_CSS));

// ── ViewModel ────────────────────────────────────────────────────────────────

type OrcidPanelStatus = 'loading' | 'loaded' | 'error';

interface OrcidPanelViewModel {
  status: OrcidPanelStatus;
  profile: OrcidResearcherProfile | null;
}

const VM_LOADING: OrcidPanelViewModel = { status: 'loading', profile: null };
const VM_ERROR:   OrcidPanelViewModel = { status: 'error',   profile: null };

// ── Composant ────────────────────────────────────────────────────────────────

@Component({
  selector: 'ds-orcid-person-enrichment',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './orcid-person-enrichment.component.html',
  styleUrls: ['./orcid-person-enrichment.component.scss'],
  standalone: true,
  imports: [AsyncPipe, NgFor, NgIf, SlicePipe, TranslateModule],
})
export class OrcidPersonEnrichmentComponent implements OnInit {
  @Input() item!: Item;

  private readonly orcidService = inject(OrcidPublicApiService);

  /**
   * Flux du ViewModel exposé au template.
   * Reste sur `EMPTY` (rien n'est rendu) si aucun ORCID iD n'est trouvé,
   * ce qui évite d'afficher un panneau vide ou en erreur.
   */
  vm$: Observable<OrcidPanelViewModel> = EMPTY;

  /** Onglet actif : 0 = Biographie, 1 = Affiliations, 2 = Publications */
  activeTab = 0;

  /** Nombre de publications affichées par défaut avant le bouton "voir plus". */
  readonly worksPreviewCount = 5;

  /** État d'expansion de la liste des publications. */
  showAllWorks = false;

  ngOnInit(): void {
    const orcidId = this.extractOrcidId();

    if (!orcidId) {
      return; // Pas d'iD → panneau non rendu (vm$ reste EMPTY)
    }

    this.vm$ = this.orcidService.getResearcherProfile(orcidId).pipe(
      map((profile): OrcidPanelViewModel => ({ status: 'loaded', profile })),
      catchError(() => [VM_ERROR]),
      startWith(VM_LOADING),
    );
  }

  // ── Méthodes template ─────────────────────────────────────────────────────

  /** Change l'onglet actif. */
  setTab(index: number): void {
    this.activeTab = index;
  }

  /**
   * Retourne la clé i18n correspondant au type de travail ORCID.
   * Repli sur `other` pour les types non reconnus.
   */
  workTypeKey(type: string): string {
    return `${WORK_TYPE_I18N_PREFIX}${KNOWN_WORK_TYPES.has(type) ? type : 'other'}`;
  }

  /** Retourne la classe CSS du badge pour un type de travail ORCID. */
  workTypeClass(type: string): string {
    return WORK_TYPE_CSS[type] ?? 'badge-other';
  }

  /** TrackBy pour la liste des publications (évite les re-renders inutiles). */
  trackByPutCode(_index: number, work: OrcidWork): number {
    return work.putCode;
  }

  /** Bascule l'affichage complet / réduit de la liste des publications. */
  toggleWorks(): void {
    this.showAllWorks = !this.showAllWorks;
  }

  // ── Utilitaires privés ────────────────────────────────────────────────────

  /**
   * Extrait et normalise l'ORCID iD depuis les métadonnées DSpace.
   * Accepte aussi bien `0000-0000-0000-0000` que `https://orcid.org/0000-…`.
   * Retourne `null` si la valeur est absente ou vide.
   */
  /**
   * Clés de métadonnées DSpace connues pour l'ORCID iD, par ordre de priorité.
   *
   * | Clé                    | Contexte                           |
   * |------------------------|------------------------------------|
   * | dspace.author.orcid    | DSpace 7 / demo.dspace.org         |
   * | person.identifier.orcid| Schéma research-entities classique |
   */
  private static readonly ORCID_METADATA_KEYS = [
    'dspace.author.orcid',
    'person.identifier.orcid',
  ] as const;

  private extractOrcidId(): string | null {
    let raw: string | undefined;

    for (const key of OrcidPersonEnrichmentComponent.ORCID_METADATA_KEYS) {
      const val = this.item?.firstMetadataValue(key);
      if (val) { raw = val; break; }
    }

    if (!raw) return null;

    // Accepte : "0000-0002-…", "https://orcid.org/0000-…", "orcid.org/0000-…"
    const id = raw.replace(/^(https?:\/\/)?orcid\.org\//, '').trim();
    return id || null;
  }
}