import {
  AsyncPipe,
  isPlatformBrowser,
} from '@angular/common';
import {
  Component,
  DestroyRef,
  ElementRef,
  inject,
  OnInit,
  PLATFORM_ID,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  Meta,
  Title,
} from '@angular/platform-browser';
import {
  ActivatedRoute,
  NavigationEnd,
  ParamMap,
} from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import {
  combineLatest,
  Observable,
  of,
} from 'rxjs';
import {
  catchError,
  defaultIfEmpty,
  filter,
  map,
  tap,
} from 'rxjs/operators';

import { DSONameService } from '../../../../../../../app/core/breadcrumbs/dso-name.service';
import { FindListOptions } from '../../../../../../../app/core/data/find-list-options.model';
import { RelationshipDataService } from '../../../../../../../app/core/data/relationship-data.service';
import { Context } from '../../../../../../../app/core/shared/context.model';
import { getFirstCompletedRemoteData } from '../../../../../../../app/core/shared/operators';
import { ViewMode } from '../../../../../../../app/core/shared/view-mode.model';
import { PersonComponent as BaseComponent } from '../../../../../../../app/entity-groups/research-entities/item-pages/person/person.component';
import { GenericItemPageFieldComponent } from '../../../../../../../app/item-page/simple/field-components/specific-field/generic/generic-item-page-field.component';
import { ItemPageUriFieldComponent } from '../../../../../../../app/item-page/simple/field-components/specific-field/uri/item-page-uri-field.component';
import { TabbedRelatedEntitiesSearchComponent } from '../../../../../../../app/item-page/simple/related-entities/tabbed-related-entities-search/tabbed-related-entities-search.component';
import { RelatedItemsComponent } from '../../../../../../../app/item-page/simple/related-items/related-items-component';
import { DsoEditMenuComponent } from '../../../../../../../app/shared/dso-page/dso-edit-menu/dso-edit-menu.component';
import { ThemedLoadingComponent } from '../../../../../../../app/shared/loading/themed-loading.component';
import { MetadataFieldWrapperComponent } from '../../../../../../../app/shared/metadata-field-wrapper/metadata-field-wrapper.component';
import { listableObjectComponent } from '../../../../../../../app/shared/object-collection/shared/listable-object/listable-object.decorator';
import { ThemedThumbnailComponent } from '../../../../../../../app/thumbnail/themed-thumbnail.component';
import { getOrcidId } from '../../../../orcid-members/orcid-id';
import { OrcidPersonEnrichmentComponent } from '../../../../orcid-members/orcid-person-enrichment/orcid-person-enrichment.component';
import { hasPresentationContent } from '../../../../orcid-members/orcid-profile-content';
import {
  OrcidPublicApiService,
  OrcidResearcherProfile,
} from '../../../../orcid-members/orcid-public-api.service';
import { getPersonDisplayName } from '../../person-name';

type ProfileTabId = 'presentation' | 'works' | 'fundings' | 'publications';

/** Paramètre d'URL de l'onglet actif, partagé avec les sous-onglets de ds-tabbed-related-entities-search. */
const TAB_PARAM = 'tab';

interface ProfileTab {
  id: ProfileTabId;
  label: string;
  /** Onglet marqué du logo ORCID. Pas Financements, qui viendra de Synchro Recherche. */
  orcid: boolean;
}

const PRESENTATION_TAB: ProfileTab = { id: 'presentation', label: 'papyrus.person.page.tab.presentation', orcid: true };
const WORKS_TAB: ProfileTab = { id: 'works', label: 'papyrus.person.page.tab.works', orcid: true };
const FUNDINGS_TAB: ProfileTab = { id: 'fundings', label: 'papyrus.person.page.tab.fundings', orcid: false };
const PUBLICATIONS_TAB: ProfileTab = { id: 'publications', label: 'papyrus.person.page.tab.papyrus', orcid: false };

/** Expertises visibles avant « Voir plus ». */
const EXPERTISE_PREVIEW_COUNT = 10;

/** Sous-onglet de recherche des publications Papyrus, au format de ds-tabbed-related-entities-search. */
interface PublicationRole {
  label: string;
  filter: string;
  configuration: string;
}

/**
 * Rôles de la personne dans les publications, comme le modèle standard DSpace (ex. nosmu.scholaris.ca).
 * `relationship` est le libellé vu depuis la personne, utilisé pour savoir si le rôle a des publications.
 */
const PUBLICATION_ROLES: { relationship: string; role: PublicationRole }[] = [
  {
    relationship: 'isPublicationOfAuthor',
    role: { label: 'isAuthorOfPublication', filter: 'isAuthorOfPublication', configuration: 'default-relationships' },
  },
  {
    relationship: 'isPublicationOfAdvisor',
    role: { label: 'isAdvisorOfPublication', filter: 'isAdvisorOfPublication', configuration: 'default-relationships' },
  },
];

interface ProfileContent {
  tabs: ProfileTab[];
  /** Rôles ayant au moins une publication ; vide : message « aucune publication ». */
  publicationRoles: PublicationRole[];
}

interface ProfileView extends ProfileContent {
  activeTab: ProfileTabId;
}

/**
 * Fiche Person en onglets : Présentation, Travaux et Financements viennent d'ORCID, Publications dans Papyrus
 * des relations, cherchables par rôle (auteur·e, direction de recherche). Un onglet sans contenu n'est pas
 * affiché, sauf Publications dans Papyrus, toujours présent avec un message s'il est vide.
 *
 * L'onglet actif est dans l'URL, comme les sous-onglets DSpace : `?tab=presentation`, `works`, `fundings`,
 * et pour les publications le rôle affiché (`isAuthorOfPublication`, `isAdvisorOfPublication`).
 * Sans paramètre, le premier onglet disponible est affiché.
 */
@listableObjectComponent('Person', ViewMode.StandalonePage, Context.Any, 'annuaires')
@Component({
  selector: 'ds-person',
  styleUrls: [
    '../../../../../../../app/entity-groups/research-entities/item-pages/person/person.component.scss',
  ],
  templateUrl: './person.component.html',
  imports: [
    AsyncPipe,
    DsoEditMenuComponent,
    GenericItemPageFieldComponent,
    ItemPageUriFieldComponent,
    MetadataFieldWrapperComponent,
    OrcidPersonEnrichmentComponent,
    RelatedItemsComponent,
    TabbedRelatedEntitiesSearchComponent,
    ThemedLoadingComponent,
    ThemedThumbnailComponent,
    TranslateModule,
  ],
})
export class PersonComponent extends BaseComponent implements OnInit {

  /** Émis une fois les données ORCID et les publications connues, pour ne pas faire bouger la barre. */
  view$: Observable<ProfileView>;

  readonly expertisePreviewCount = EXPERTISE_PREVIEW_COUNT;

  showAllExpertises = false;

  private readonly elementRef: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly dsoNameService = inject(DSONameService);
  private readonly orcidService = inject(OrcidPublicApiService);
  private readonly relationshipService = inject(RelationshipDataService);
  private readonly route = inject(ActivatedRoute);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly destroyRef = inject(DestroyRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** « Prénom Nom », sinon le nom DSpace habituel. */
  get displayName(): string {
    return getPersonDisplayName(this.object) ?? this.dsoNameService.getName(this.object);
  }

  get orcidId(): string | null {
    return getOrcidId(this.object);
  }

  get emails(): string[] {
    return this.object?.allMetadataValues('person.email') ?? [];
  }

  get expertises(): string[] {
    return this.object?.allMetadataValues('dc.subject.discipline') ?? [];
  }

  get visibleExpertises(): string[] {
    return this.showAllExpertises ? this.expertises : this.expertises.slice(0, EXPERTISE_PREVIEW_COUNT);
  }

  ngOnInit(): void {
    super.ngOnInit();
    const content$ = combineLatest([this.loadOrcidProfile(), this.loadPublicationRoles()]).pipe(
      map(([profile, publicationRoles]): ProfileContent => ({
        tabs: [
          ...(hasPresentationContent(profile) ? [PRESENTATION_TAB] : []),
          ...(profile?.works.length > 0 ? [WORKS_TAB] : []),
          ...(profile?.fundings.length > 0 ? [FUNDINGS_TAB] : []),
          PUBLICATIONS_TAB,
        ],
        publicationRoles,
      })),
    );
    this.view$ = combineLatest([content$, this.route.queryParamMap]).pipe(
      map(([content, params]): ProfileView => ({ ...content, activeTab: this.resolveActiveTab(content, params) })),
      tap((view) => {
        this.openFirstPublicationRole(view);
        this.revealActiveTab();
      }),
    );

    this.setPageTitle();
    // HeadTagService remet le titre DSpace à chaque NavigationEnd. Abonné après lui, on passe en dernier.
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(() => this.setPageTitle());
  }

  toggleExpertises(): void {
    this.showAllExpertises = !this.showAllExpertises;
  }

  /** Comme les sous-onglets DSpace : nouvelle URL, sans les paramètres de recherche de l'onglet précédent. */
  selectTab(tab: ProfileTabId, view: ProfileView): void {
    if (tab === view.activeTab) {
      return;
    }
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { [TAB_PARAM]: this.tabParam(tab, view) },
    });
  }

  /** Flèches gauche/droite, Début et Fin entre les onglets (motif ARIA « tabs »). */
  onTabKeydown(event: KeyboardEvent, view: ProfileView, index: number): void {
    const tabs = view.tabs;
    const target = {
      ArrowLeft: (index - 1 + tabs.length) % tabs.length,
      ArrowRight: (index + 1) % tabs.length,
      Home: 0,
      End: tabs.length - 1,
    }[event.key];
    if (target === undefined) {
      return;
    }
    event.preventDefault();
    this.selectTab(tabs[target].id, view);
    this.elementRef.nativeElement.querySelector<HTMLElement>(`#profile-tab-${tabs[target].id}`)?.focus();
  }

  /**
   * Onglet demandé par l'URL s'il est affiché. Un rôle de publication ou une recherche (`spc.*`) ouvre
   * Publications dans Papyrus ; un onglet inconnu ou masqué (profil ORCID modifié), le premier onglet.
   */
  private resolveActiveTab(content: ProfileContent, params: ParamMap): ProfileTabId {
    const tab = params.get(TAB_PARAM);
    if (content.tabs.some(({ id }) => id === tab)) {
      return tab as ProfileTabId;
    }
    const isPublicationSearch = PUBLICATION_ROLES.some(({ role }) => role.filter === tab)
      || params.keys.some((key) => key.startsWith('spc.'));
    return isPublicationSearch ? 'publications' : content.tabs[0].id;
  }

  /** `?tab=publications` saisi à la main : remplacé par le premier rôle, sinon la recherche resterait vide. */
  private openFirstPublicationRole(view: ProfileView): void {
    const role = view.publicationRoles[0];
    if (role && this.route.snapshot.queryParamMap.get(TAB_PARAM) === 'publications') {
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { [TAB_PARAM]: role.filter },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }
  }

  /** Mobile : centre l'onglet actif dans la barre défilante, sans faire défiler la page. */
  private revealActiveTab(): void {
    if (!this.isBrowser) {
      return;
    }
    setTimeout(() => {
      const list = this.elementRef.nativeElement.querySelector<HTMLElement>('.profile-tabs');
      const active = list?.querySelector<HTMLElement>('.nav-link.active');
      if (!active || list.scrollWidth <= list.clientWidth) {
        return;
      }
      const listRect = list.getBoundingClientRect();
      const activeRect = active.getBoundingClientRect();
      list.scrollLeft += activeRect.left - listRect.left - (listRect.width - activeRect.width) / 2;
    });
  }

  /** Publications s'ouvre sur son premier rôle, le sous-onglet actif de la recherche. */
  private tabParam(tab: ProfileTabId, content: ProfileContent): string {
    return tab === 'publications' ? content.publicationRoles[0]?.filter ?? tab : tab;
  }

  /** Même requête que le panneau ORCID : le service la partage et la met en cache. Null si indisponible. */
  private loadOrcidProfile(): Observable<OrcidResearcherProfile | null> {
    const orcidId = this.orcidId;
    if (!orcidId) {
      return of(null);
    }
    return this.orcidService.getResearcherProfile(orcidId).pipe(
      defaultIfEmpty(null),
      catchError(() => of(null)),
    );
  }

  /** Rôles de PUBLICATION_ROLES ayant au moins une publication (une relation demandée par rôle). */
  private loadPublicationRoles(): Observable<PublicationRole[]> {
    const options = Object.assign(new FindListOptions(), { elementsPerPage: 1 });
    return combineLatest(PUBLICATION_ROLES.map(({ relationship, role }) =>
      this.relationshipService.getItemRelationshipsByLabel(this.object, relationship, options).pipe(
        getFirstCompletedRemoteData(),
        map((rd) => rd.hasSucceeded && rd.payload?.totalElements > 0 ? role : null),
      ),
    )).pipe(
      map((roles) => roles.filter((role): role is PublicationRole => role !== null)),
    );
  }

  private setPageTitle(): void {
    const name = getPersonDisplayName(this.object);
    if (name) {
      this.title.setTitle(name);
      this.meta.updateTag({ name: 'title', content: name });
    }
  }
}
