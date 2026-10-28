import { AsyncPipe, NgFor, NgIf, SlicePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, Input, OnInit } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';
import { catchError, map, startWith } from 'rxjs/operators';

import { Item } from '../../../../../app/core/shared/item.model';
import {
  OrcidAffiliationEntry,
  OrcidPublicApiService,
  OrcidResearcherProfile,
  OrcidWork,
} from '../orcid-public-api.service';

// ── Types de travaux ──────────────────────────────────────────────────────────

const WORK_TYPE_I18N_PREFIX = 'papyrus.orcid-profile.work-type.';

/** Type ORCID → classe CSS du badge. */
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

/** Catégorie regroupant tous les types ORCID absents de WORK_TYPE_CSS. */
const OTHER_WORK_TYPE = 'other';

// ── Détection de langue de la biographie ──────────────────────────────────────
// Heuristique maison (aucune librairie ni appel externe) : mots-outils FR forts/faibles,
// élisions et densité d'accents propres au français, comparés aux mots-outils anglais.
// Les marqueurs faibles sont partagés avec d'autres langues romanes, d'où leur faible poids.

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
// Exclut volontairement les trémas allemands et les accents espagnols.
const FRENCH_ACCENT_RE = /[éèêàâçîïôû]/gi;

const FRENCH_SCORE_THRESHOLD = 0.26;
const WEAK_MARKER_WEIGHT = 0.2;
const ELISION_WEIGHT = 2.5;
const ACCENT_DENSITY_COEFFICIENT = 3;
const ACCENT_BONUS_CAP = 1;

// ── ViewModel ─────────────────────────────────────────────────────────────────

type OrcidPanelStatus = 'loading' | 'loaded' | 'error' | 'no-orcid';

interface OrcidPanelViewModel {
  status: OrcidPanelStatus;
  profile: OrcidResearcherProfile | null;
}

const VM_LOADING:  OrcidPanelViewModel = { status: 'loading',  profile: null };
const VM_ERROR:    OrcidPanelViewModel = { status: 'error',    profile: null };
const VM_NO_ORCID: OrcidPanelViewModel = { status: 'no-orcid', profile: null };

/** Catégories d'activités de l'accordéon (rendues seulement si non vides, sauf travaux et financement). */
export type ActivityTab =
  | 'works'
  | 'funding'
  | 'distinctions'
  | 'educations'
  | 'memberships'
  | 'qualifications'
  | 'services'
  | 'peer-reviews'
  | 'research-resources';

// ── Composant ─────────────────────────────────────────────────────────────────

@Component({
  selector: 'ds-orcid-person-enrichment',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './orcid-person-enrichment.component.html',
  styleUrls: ['./orcid-person-enrichment.component.scss'],
  standalone: true,
  imports: [AsyncPipe, NgFor, NgIf, SlicePipe, TranslateModule],
})
export class OrcidPersonEnrichmentComponent implements OnInit {
  /** Clés de métadonnées DSpace portant l'ORCID iD, par ordre de priorité. */
  private static readonly ORCID_METADATA_KEYS = [
    'dspace.author.orcid',
    'person.identifier.orcid',
  ] as const;

  @Input() item!: Item;

  private readonly orcidService = inject(OrcidPublicApiService);

  vm$: Observable<OrcidPanelViewModel> = of(VM_NO_ORCID);

  /** Caractères de biographie affichés avant « voir plus ». */
  readonly bioPreviewLength = 800;
  showFullBio = false;

  /** Publications affichées avant « voir plus ». */
  readonly worksPreviewCount = 5;
  showAllWorks = false;

  /** Financements affichés avant « voir plus ». */
  readonly fundingsPreviewCount = 5;
  showAllFundings = false;

  /** Filtre de type de travail actif (null = tous). */
  activeWorkTypeFilter: string | null = null;

  /** Sections dépliées de l'accordéon, indépendantes les unes des autres (toutes repliées au départ). */
  expandedSections = new Set<ActivityTab>();

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

  // ── Biographie ────────────────────────────────────────────────────────────

  /**
   * Vrai si le texte semble être en français (heuristique, pas une détection fiable).
   * Sert à masquer les biographies dans une autre langue, l'annuaire étant en français.
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

  /** Tronque la biographie à la frontière de mot la plus proche de bioPreviewLength. */
  truncatedBio(bio: string): string {
    if (bio.length <= this.bioPreviewLength) {
      return bio;
    }
    const cut = bio.lastIndexOf(' ', this.bioPreviewLength);
    return `${bio.slice(0, cut > 0 ? cut : this.bioPreviewLength)}…`;
  }

  toggleBio(): void {
    this.showFullBio = !this.showFullBio;
  }

  // ── Travaux ───────────────────────────────────────────────────────────────

  /** Clé i18n du type de travail (repli sur `other` pour les types non reconnus). */
  workTypeKey(type: string): string {
    return `${WORK_TYPE_I18N_PREFIX}${this.workBucket(type)}`;
  }

  workTypeClass(type: string): string {
    return WORK_TYPE_CSS[type] ?? 'badge-other';
  }

  /** Nombre de travaux par catégorie affichée : les types inconnus sont cumulés sous « Autre ». */
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

  filteredWorks(works: OrcidWork[]): OrcidWork[] {
    return this.activeWorkTypeFilter
      ? works.filter((work) => this.workBucket(work.type) === this.activeWorkTypeFilter)
      : works;
  }

  /** Change le filtre actif et réinitialise « voir plus ». */
  setWorkTypeFilter(type: string | null): void {
    this.activeWorkTypeFilter = type;
    this.showAllWorks = false;
  }

  toggleWorks(): void {
    this.showAllWorks = !this.showAllWorks;
  }

  // ── Financement ───────────────────────────────────────────────────────────

  toggleFundings(): void {
    this.showAllFundings = !this.showAllFundings;
  }

  // ── Accordéon ─────────────────────────────────────────────────────────────

  isExpanded(section: ActivityTab): boolean {
    return this.expandedSections.has(section);
  }

  /** Nouveau Set à chaque bascule pour que OnPush détecte le changement de référence. */
  toggleSection(section: ActivityTab): void {
    const next = new Set(this.expandedSections);
    if (next.has(section)) {
      next.delete(section);
    } else {
      next.add(section);
    }
    this.expandedSections = next;
  }

  // ── TrackBy ───────────────────────────────────────────────────────────────

  trackByPutCode(_index: number, work: OrcidWork): number {
    return work.putCode;
  }

  trackByAffiliationPutCode(_index: number, entry: OrcidAffiliationEntry): number {
    return entry.putCode;
  }

  /** Revues par les pairs et ressources de recherche n'ont pas d'identifiant stable côté ORCID. */
  trackByIndex(index: number): number {
    return index;
  }

  // ── Privé ─────────────────────────────────────────────────────────────────

  private workBucket(type: string): string {
    return KNOWN_WORK_TYPES.has(type) ? type : OTHER_WORK_TYPE;
  }

  /** ORCID iD normalisé depuis les métadonnées (accepte l'identifiant nu ou l'URL orcid.org), sinon null. */
  private extractOrcidId(): string | null {
    let raw: string | undefined;

    for (const key of OrcidPersonEnrichmentComponent.ORCID_METADATA_KEYS) {
      const val = this.item?.firstMetadataValue(key);
      if (val) { raw = val; break; }
    }

    if (!raw) return null;

    const id = raw.replace(/^(https?:\/\/)?orcid\.org\//, '').trim();
    return id || null;
  }
}
