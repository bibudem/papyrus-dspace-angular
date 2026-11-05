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
import { hasFrenchBiography } from '../orcid-profile-content';
import {
  compareByStartDateDesc,
  OrcidAffiliationEntry,
  OrcidPublicApiService,
  OrcidResearcherProfile,
  OrcidWork,
} from '../orcid-public-api.service';

const WORK_TYPE_I18N_PREFIX = 'papyrus.orcid-profile.work-type.';

/** Types de travaux ORCID ayant leur propre libellé ; les autres sont regroupés sous « Autre ». */
const KNOWN_WORK_TYPES = new Set([
  'journal-article',
  'book',
  'book-chapter',
  'conference-paper',
  'dissertation-thesis',
  'report',
  'preprint',
]);

const OTHER_WORK_TYPE = 'other';

/** Catégories ORCID regroupées sous « Activités professionnelles », comme sur orcid.org. */
type ProfessionalActivityKind = 'distinction' | 'invited-position' | 'membership' | 'service';

interface ProfessionalActivity extends OrcidAffiliationEntry {
  kind: ProfessionalActivityKind;
}

/** Une distinction est ponctuelle : sans date de fin, elle n'est pas « en cours ». */
const ONGOING_KINDS: ReadonlySet<ProfessionalActivityKind> = new Set(['invited-position', 'membership', 'service']);

/** Partie du profil affichée, une par onglet de la fiche. */
export type OrcidProfileSection = 'presentation' | 'works' | 'fundings';

/** Sections de l'accordéon de la présentation. */
type ActivitySection = 'professional-activities' | 'educations';

interface OrcidPanelViewModel {
  status: 'loading' | 'loaded' | 'unavailable';
  profile: OrcidResearcherProfile | null;
  professionalActivities: ProfessionalActivity[];
}

const VM_LOADING: OrcidPanelViewModel = { status: 'loading', profile: null, professionalActivities: [] };
const VM_UNAVAILABLE: OrcidPanelViewModel = { status: 'unavailable', profile: null, professionalActivities: [] };

/**
 * Une partie du profil ORCID public d'une personne : présentation (biographie et activités en accordéon),
 * travaux ou financements. Les onglets partagent la même requête, mise en cache par le service.
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

  @Input() section: OrcidProfileSection = 'presentation';

  vm$: Observable<OrcidPanelViewModel> = of(VM_UNAVAILABLE);

  /** Caractères de biographie affichés avant « voir plus ». */
  readonly bioPreviewLength = 800;
  showFullBio = false;

  readonly worksPreviewCount = 10;
  showAllWorks = false;

  readonly fundingsPreviewCount = 10;
  showAllFundings = false;

  /** Type de travail filtré, null pour tous. */
  activeWorkTypeFilter: string | null = null;

  /** Sections dépliées : Activités professionnelles ouverte au départ (rendue seulement si elle a du contenu). */
  expandedSections = new Set<ActivitySection>(['professional-activities']);

  readonly hasFrenchBiography = hasFrenchBiography;

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
        return of(VM_UNAVAILABLE);
      }),
      startWith(VM_LOADING),
    );
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
