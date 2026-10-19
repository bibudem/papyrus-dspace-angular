import { AsyncPipe, NgFor, NgIf, SlicePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, Input, OnInit } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';
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

/** Catégorie fourre-tout pour tout type ORCID non listé dans WORK_TYPE_CSS. */
const OTHER_WORK_TYPE = 'other';

/**
 * Détection de langue heuristique pour la biographie ORCID (aucune librairie de détection de
 * langue disponible dans ce projet — package.json ne doit pas changer, et pas d'appel réseau
 * à un service externe non plus). Combine 3 signaux plutôt qu'un simple comptage de mots :
 *
 * 1. Mots-outils quasi exclusifs au français parmi les langues testées (ne sont PAS "de", "la",
 *    "un"... qui existent aussi en espagnol/italien/portugais avec un sens proche) — poids fort.
 * 2. Mots-outils français ambigus (partagés avec d'autres langues romanes) — poids faible, pour
 *    ne pas faire basculer un texte espagnol/italien vers "français" à eux seuls.
 * 3. Élisions françaises (qu', d', l', jusqu'à...) — quasi uniques au français.
 * 4. Densité d'accents propres au français (é, è, ê, à, â, ç, î, ï, ô, û) — exclut
 *    volontairement ä/ö/ü (tréma allemand) et á/í/ó/ú/ñ (espagnol), pour ne pas les compter
 *    comme un signal français.
 *
 * Calibré empiriquement sur un jeu de phrases françaises (longues/courtes, avec/sans accents),
 * anglaises, espagnoles, italiennes, portugaises et allemandes. Limite assumée : reste une
 * heuristique, pas une détection de langue fiable — le cas visé en priorité est l'anglais.
 */
const STRONG_FRENCH_MARKERS = new Set([
  'etre', 'ete', 'avec', 'dans', 'nous', 'vous', 'qui', 'tres', 'ou', 'deja', 'ainsi',
  'cependant', 'egalement', 'toujours', 'donc', 'aussi', 'pour', 'chez', 'sans', 'mais',
  'pas', 'ne', 'sont', 'ont', 'fait', 'leur', 'leurs', 'depuis', 'entre', 'comme', 'alors',
  'ses', 'cette', 'ces', 'quelque', 'lorsque', 'puisque', 'neanmoins', 'voila', 'hui',
  'notre', 'votre', 'celui', 'celle', 'ceux', 'plusieurs', 'chaque', 'tant', 'et',
]);
const WEAK_FRENCH_MARKERS = new Set(['de', 'des', 'du', 'un', 'une', 'le', 'la', 'les', 'au', 'aux', 'en']);
const STRONG_ENGLISH_MARKERS = new Set([
  'the', 'and', 'of', 'is', 'this', 'that', 'with', 'for', 'are', 'have', 'to', 'it',
  'in', 'on', 'which', 'who', 'about', 'these', 'those', 'because', 'as', 'was', 'were',
  'been', 'will', 'would', 'can', 'could', 'should', 'not', 'from', 'by', 'an', 'at',
  'but', 'or', 'if', 'so', 'than', 'then', 'when', 'where', 'what', 'how', 'my', 'your',
  'his', 'her', 'their', 'our', 'its',
]);
const FRENCH_ELISION_RE = /\b(?:qu|jusqu|puisqu|lorsqu|quoiqu)['’]|\b[ldnsjmct]['’]/gi;
const FRENCH_ACCENT_RE = /[éèêàâçîïôû]/gi;

const FRENCH_SCORE_THRESHOLD = 0.26;
const WEAK_MARKER_WEIGHT = 0.2;
const ELISION_WEIGHT = 2.5;
const ACCENT_DENSITY_COEFFICIENT = 3;
const ACCENT_BONUS_CAP = 1;

// ── ViewModel ────────────────────────────────────────────────────────────────

type OrcidPanelStatus = 'loading' | 'loaded' | 'error' | 'no-orcid';

interface OrcidPanelViewModel {
  status: OrcidPanelStatus;
  profile: OrcidResearcherProfile | null;
}

const VM_LOADING:  OrcidPanelViewModel = { status: 'loading',  profile: null };
const VM_ERROR:    OrcidPanelViewModel = { status: 'error',    profile: null };
const VM_NO_ORCID: OrcidPanelViewModel = { status: 'no-orcid', profile: null };

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

  /** Flux du ViewModel exposé au template. */
  vm$: Observable<OrcidPanelViewModel> = of(VM_NO_ORCID);

  /** Nombre de caractères de la biographie affichés avant le bouton "voir plus". */
  readonly bioPreviewLength = 800;

  /** État d'expansion de la biographie. */
  showFullBio = false;

  /** Nombre de publications affichées par défaut avant le bouton "voir plus". */
  readonly worksPreviewCount = 5;

  /** État d'expansion de la liste des publications. */
  showAllWorks = false;

  /** Nombre de financements affichés par défaut avant le bouton "voir plus". */
  readonly fundingsPreviewCount = 5;

  /** État d'expansion de la liste des financements. */
  showAllFundings = false;

  /** Type de travail actif pour le filtre (null = tous). */
  activeWorkTypeFilter: string | null = null;

  /** Sous-onglet actif entre Travaux et Financement — Travaux par défaut. */
  activeWorksTab: 'works' | 'funding' = 'works';

  ngOnInit(): void {
    const orcidId = this.extractOrcidId();

    if (!orcidId) {
      this.vm$ = of(VM_NO_ORCID);
      return;
    }

    this.vm$ = this.orcidService.getResearcherProfile(orcidId).pipe(
      map((profile): OrcidPanelViewModel => ({ status: 'loaded', profile })),
      catchError((err) => {
        console.error(`[OrcidEnrichment] Échec du chargement du profil ${orcidId}`, err);
        return [VM_ERROR];
      }),
      startWith(VM_LOADING),
    );
  }

  // ── Méthodes template ─────────────────────────────────────────────────────

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

  /** Bascule l'affichage complet / réduit de la biographie. */
  toggleBio(): void {
    this.showFullBio = !this.showFullBio;
  }

  /**
   * Vrai si le texte semble être en français — détection heuristique à plusieurs signaux
   * (voir le commentaire au-dessus des constantes STRONG_FRENCH_MARKERS et suivantes), pas une
   * détection de langue fiable. Sert à masquer les biographies ORCID saisies en anglais ou
   * dans une autre langue (le reste de l'annuaire est en français).
   */
  isFrenchText(text: string): boolean {
    const normalized = text.toLowerCase()
      .replace(/[éèêë]/g, 'e').replace(/[àâä]/g, 'a').replace(/[ôö]/g, 'o')
      .replace(/[ùûü]/g, 'u').replace(/ç/g, 'c').replace(/[ïî]/g, 'i');
    const words = normalized.match(/[a-z]+/g) ?? [];
    if (words.length === 0) {
      return false;
    }

    const elisionCount = (text.match(FRENCH_ELISION_RE) ?? []).length;
    const strongHits = words.filter((word) => STRONG_FRENCH_MARKERS.has(word)).length;
    const weakHits = words.filter((word) => WEAK_FRENCH_MARKERS.has(word)).length;
    const englishHits = words.filter((word) => STRONG_ENGLISH_MARKERS.has(word)).length;
    const accentCount = (text.match(FRENCH_ACCENT_RE) ?? []).length;

    const accentBonus = Math.min((accentCount / words.length) * ACCENT_DENSITY_COEFFICIENT, ACCENT_BONUS_CAP);
    const frenchScore = (strongHits * 2 + weakHits * WEAK_MARKER_WEIGHT + elisionCount * ELISION_WEIGHT) / words.length + accentBonus;
    const englishScore = (englishHits * 2) / words.length;

    return frenchScore >= FRENCH_SCORE_THRESHOLD && frenchScore > englishScore;
  }

  /** Tronque la biographie à la frontière d'un mot la plus proche de bioPreviewLength. */
  truncatedBio(bio: string): string {
    if (bio.length <= this.bioPreviewLength) {
      return bio;
    }
    const cut = bio.lastIndexOf(' ', this.bioPreviewLength);
    return `${bio.slice(0, cut > 0 ? cut : this.bioPreviewLength)}…`;
  }

  /** Bascule l'affichage complet / réduit de la liste des publications. */
  toggleWorks(): void {
    this.showAllWorks = !this.showAllWorks;
  }

  /** Bascule l'affichage complet / réduit de la liste des financements. */
  toggleFundings(): void {
    this.showAllFundings = !this.showAllFundings;
  }

  /** Change le sous-onglet actif entre Travaux et Financement. */
  setWorksTab(tab: 'works' | 'funding'): void {
    this.activeWorksTab = tab;
  }

  /** Change le filtre de type de travail actif ; réinitialise "voir plus". */
  setWorkTypeFilter(type: string | null): void {
    this.activeWorkTypeFilter = type;
    this.showAllWorks = false;
  }

  /**
   * Types de travaux présents dans le profil, avec leur nombre d'occurrences.
   * Regroupés par catégorie affichée (voir workBucket) plutôt que par type ORCID brut, sinon
   * chaque type non reconnu (il en existe une bonne dizaine sur ORCID) ressort comme une
   * pastille "Autre" séparée au lieu d'une seule, cumulant leurs décomptes.
   */
  workTypeCounts(works: OrcidWork[]): Array<{ type: string; count: number }> {
    const counts = new Map<string, number>();
    for (const work of works) {
      const bucket = this.workBucket(work.type);
      counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);
  }

  /** Travaux filtrés selon activeWorkTypeFilter (tous si aucun filtre actif). */
  filteredWorks(works: OrcidWork[]): OrcidWork[] {
    return this.activeWorkTypeFilter
      ? works.filter((work) => this.workBucket(work.type) === this.activeWorkTypeFilter)
      : works;
  }

  /** Catégorie affichée pour un type ORCID : le type lui-même s'il est connu, sinon "other". */
  private workBucket(type: string): string {
    return KNOWN_WORK_TYPES.has(type) ? type : OTHER_WORK_TYPE;
  }

  // ── Utilitaires privés ────────────────────────────────────────────────────

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

  /**
   * Extrait et normalise l'ORCID iD depuis les métadonnées DSpace.
   * Accepte aussi bien `0000-0000-0000-0000` que `https://orcid.org/0000-…`.
   * Retourne `null` si la valeur est absente ou vide.
   */
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