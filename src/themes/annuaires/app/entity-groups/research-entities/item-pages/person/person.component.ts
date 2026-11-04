import { AsyncPipe } from '@angular/common';
import {
  Component,
  DestroyRef,
  ElementRef,
  inject,
  OnInit,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  Meta,
  Title,
} from '@angular/platform-browser';
import {
  ActivatedRoute,
  NavigationEnd,
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

interface ProfileView {
  tabs: ProfileTab[];
  /** Rôles ayant au moins une publication ; vide : message « aucune publication ». */
  publicationRoles: PublicationRole[];
}

/**
 * Fiche Person en onglets : Présentation, Travaux et Financements viennent d'ORCID, Publications dans Papyrus
 * des relations, cherchables par rôle (auteur·e, direction de recherche). Un onglet sans contenu n'est pas
 * affiché, sauf Publications dans Papyrus, toujours présent avec un message s'il est vide.
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

  /** Premier onglet disponible tant que l'utilisateur n'en a pas choisi un autre. */
  activeTab: ProfileTabId;

  /** Émis une fois les données ORCID et les publications connues, pour ne pas faire bouger la barre. */
  view$: Observable<ProfileView>;

  private readonly elementRef: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly dsoNameService = inject(DSONameService);
  private readonly orcidService = inject(OrcidPublicApiService);
  private readonly relationshipService = inject(RelationshipDataService);
  private readonly route = inject(ActivatedRoute);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly destroyRef = inject(DestroyRef);

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

  ngOnInit(): void {
    super.ngOnInit();
    this.view$ = combineLatest([this.loadOrcidProfile(), this.loadPublicationRoles()]).pipe(
      map(([profile, publicationRoles]): ProfileView => ({
        tabs: [
          ...(hasPresentationContent(profile) ? [PRESENTATION_TAB] : []),
          ...(profile?.works.length > 0 ? [WORKS_TAB] : []),
          ...(profile?.fundings.length > 0 ? [FUNDINGS_TAB] : []),
          PUBLICATIONS_TAB,
        ],
        publicationRoles,
      })),
      tap((view) => this.activeTab ??= this.hasPublicationSearchParams() ? 'publications' : view.tabs[0].id),
    );

    this.setPageTitle();
    // HeadTagService remet le titre DSpace à chaque NavigationEnd. Abonné après lui, on passe en dernier.
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(() => this.setPageTitle());
  }

  selectTab(tab: ProfileTabId): void {
    this.activeTab = tab;
  }

  /** Flèches gauche/droite, Début et Fin entre les onglets (motif ARIA « tabs »). */
  onTabKeydown(event: KeyboardEvent, tabs: ProfileTab[], index: number): void {
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
    this.selectTab(tabs[target].id);
    this.elementRef.nativeElement.querySelector<HTMLElement>(`#profile-tab-${tabs[target].id}`)?.focus();
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

  /** Lien partagé ou page rechargée sur la recherche des publications (sous-onglet `tab`, paramètres `spc.*`). */
  private hasPublicationSearchParams(): boolean {
    const params = Object.keys(this.route.snapshot.queryParams);
    return params.includes('tab') || params.some((param) => param.startsWith('spc.'));
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
