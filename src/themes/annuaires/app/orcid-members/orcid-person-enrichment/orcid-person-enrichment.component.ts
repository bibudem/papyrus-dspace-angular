import {
  AsyncPipe,
  NgTemplateOutlet,
  SlicePipe,
  UpperCasePipe,
} from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  Input,
  OnInit,
} from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import {
  Observable,
  of,
} from 'rxjs';
import {
  catchError,
  map,
  startWith,
} from 'rxjs/operators';

import { Item } from '../../../../../app/core/shared/item.model';
import { getOrcidId } from '../orcid-id';
import {
  compareByStartDateDesc,
  OrcidAffiliationEntry,
  OrcidPublicApiService,
  OrcidResearcherProfile,
  OrcidWork,
} from '../orcid-public-api.service';

const WORK_TYPE_I18N_PREFIX = 'papyrus.orcid-profile.work-type.';

/** Type de travail ORCID vers la classe CSS de son badge. */
const WORK_TYPE_CSS: Readonly<Record<string, string>> = {
  'journal-article': 'badge-article',
  'book': 'badge-book',
  'book-chapter': 'badge-book',
  'conference-paper': 'badge-conference',
  'dissertation-thesis': 'badge-thesis',
  'report': 'badge-report',
  'preprint': 'badge-preprint',
};

const KNOWN_WORK_TYPES = new Set(Object.keys(WORK_TYPE_CSS));

/** Regroupe les types ORCID absents de WORK_TYPE_CSS. */
const OTHER_WORK_TYPE = 'other';

/*
 * Détection du français dans la biographie, sans librairie : mots-outils, élisions et densité d'accents,
 * comparés aux mots-outils anglais. Les marqueurs faibles existent aussi dans d'autres langues romanes,
 * d'où leur faible poids.
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
// Exclut volontairement les trémas allemands et les accents espagnols.
const FRENCH_ACCENT_RE = /[éèêàâçîïôû]/gi;

const FRENCH_SCORE_THRESHOLD = 0.26;
const WEAK_MARKER_WEIGHT = 0.2;
const ELISION_WEIGHT = 2.5;
const ACCENT_DENSITY_COEFFICIENT = 3;
const ACCENT_BONUS_CAP = 1;

/** Catégories ORCID regroupées sous « Activités professionnelles », comme sur orcid.org. */
type ProfessionalActivityKind = 'distinction' | 'invited-position' | 'membership' | 'service';

interface ProfessionalActivity extends OrcidAffiliationEntry {
  kind: ProfessionalActivityKind;
}

/** Une distinction est ponctuelle : sans date de fin, elle n'est pas « en cours ». */
const ONGOING_KINDS: ReadonlySet<ProfessionalActivityKind> = new Set(['invited-position', 'membership', 'service']);

/** Sections de l'accordéon. */
type ActivitySection =
  | 'works'
  | 'funding'
  | 'professional-activities'
  | 'educations'
  | 'qualifications'
  | 'peer-reviews'
  | 'research-resources';

interface OrcidPanelViewModel {
  status: 'loading' | 'loaded' | 'error' | 'no-orcid';
  profile: OrcidResearcherProfile | null;
  professionalActivities: ProfessionalActivity[];
}

const VM_LOADING: OrcidPanelViewModel = { status: 'loading', profile: null, professionalActivities: [] };
const VM_ERROR: OrcidPanelViewModel = { status: 'error', profile: null, professionalActivities: [] };
const VM_NO_ORCID: OrcidPanelViewModel = { status: 'no-orcid', profile: null, professionalActivities: [] };

/**
 * Données du profil ORCID public d'une personne : biographie, puis un accordéon par catégorie d'activités.
 */
@Component({
  selector: 'ds-orcid-person-enrichment',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './orcid-person-enrichment.component.html',
  styleUrls: ['./orcid-person-enrichment.component.scss'],
  imports: [
    AsyncPipe,
    NgTemplateOutlet,
    SlicePipe,
    TranslateModule,
    UpperCasePipe,
  ],
})
export class OrcidPersonEnrichmentComponent implements OnInit {
  @Input() item: Item;

  vm$: Observable<OrcidPanelViewModel> = of(VM_NO_ORCID);

  /** Caractères de biographie affichés avant « voir plus ». */
  readonly bioPreviewLength = 800;
  showFullBio = false;

  readonly worksPreviewCount = 5;
  showAllWorks = false;

  readonly fundingsPreviewCount = 5;
  showAllFundings = false;

  /** Type de travail filtré, null pour tous. */
  activeWorkTypeFilter: string | null = null;

  /** Sections dépliées, toutes repliées au départ. */
  expandedSections = new Set<ActivitySection>();

  private readonly orcidService = inject(OrcidPublicApiService);

  ngOnInit(): void {
    const orcidId = getOrcidId(this.item);
    if (!orcidId) {
      return;
    }

    this.vm$ = this.orcidService.getResearcherProfile(orcidId).pipe(
      map((profile): OrcidPanelViewModel => ({
        status: 'loaded',
        profile,
        professionalActivities: this.toProfessionalActivities(profile),
      })),
      catchError((err: unknown) => {
        console.error(`[OrcidEnrichment] Échec du chargement du profil ${orcidId}`, err);
        return of(VM_ERROR);
      }),
      startWith(VM_LOADING),
    );
  }

  /** Heuristique, pas une détection fiable : sert à masquer les biographies dans une autre langue. */
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

  /** Coupe à la frontière de mot la plus proche de bioPreviewLength. */
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

  workTypeKey(type: string): string {
    return `${WORK_TYPE_I18N_PREFIX}${this.workBucket(type)}`;
  }

  workTypeClass(type: string): string {
    return WORK_TYPE_CSS[type] ?? 'badge-other';
  }

  /** Nombre de travaux par type, les types inconnus cumulés sous « Autre ». */
  workTypeCounts(works: OrcidWork[]): { type: string; count: number }[] {
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

  setWorkTypeFilter(type: string | null): void {
    this.activeWorkTypeFilter = type;
    this.showAllWorks = false;
  }

  toggleWorks(): void {
    this.showAllWorks = !this.showAllWorks;
  }

  toggleFundings(): void {
    this.showAllFundings = !this.showAllFundings;
  }

  isExpanded(section: ActivitySection): boolean {
    return this.expandedSections.has(section);
  }

  /** Nouveau Set à chaque bascule, pour que OnPush voie le changement. */
  toggleSection(section: ActivitySection): void {
    const next = new Set(this.expandedSections);
    if (next.has(section)) {
      next.delete(section);
    } else {
      next.add(section);
    }
    this.expandedSections = next;
  }

  /** Activité sans date de fin affichée « à aujourd'hui ». */
  isOngoing(activity: ProfessionalActivity): boolean {
    return ONGOING_KINDS.has(activity.kind) && !!activity.startDate && !activity.endDate;
  }

  /**
   * Département et organisme quand ils ne servent pas déjà d'intitulé, puis le lieu.
   * Ex. : « Département de médecine sociale, Université de Montréal · Montréal, QC, Canada ».
   */
  organizationLine(entry: OrcidAffiliationEntry): string {
    const unit = [
      entry.roleTitle ? entry.departmentName : undefined,
      entry.roleTitle || entry.departmentName ? entry.organizationName : undefined,
    ].filter(Boolean).join(', ');
    const place = [entry.city, entry.region, entry.country].filter(Boolean).join(', ');
    return [unit, place].filter(Boolean).join(' · ');
  }

  private toProfessionalActivities(profile: OrcidResearcherProfile): ProfessionalActivity[] {
    const withKind = (entries: OrcidAffiliationEntry[] | undefined, kind: ProfessionalActivityKind) =>
      (entries ?? []).map((entry): ProfessionalActivity => ({ ...entry, kind }));
    return [
      ...withKind(profile.distinctions, 'distinction'),
      ...withKind(profile.invitedPositions, 'invited-position'),
      ...withKind(profile.memberships, 'membership'),
      ...withKind(profile.services, 'service'),
    ].sort(compareByStartDateDesc);
  }

  private workBucket(type: string): string {
    return KNOWN_WORK_TYPES.has(type) ? type : OTHER_WORK_TYPE;
  }
}
