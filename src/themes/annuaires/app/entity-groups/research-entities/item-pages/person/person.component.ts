import { AsyncPipe } from '@angular/common';
import {
  AfterViewChecked,
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
import { NavigationEnd } from '@angular/router';
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

type ProfileTabId = 'presentation' | 'works' | 'fundings' | 'supervision' | 'publications';

interface ProfileTab {
  id: ProfileTabId;
  label: string;
  /** Onglet marqué du logo ORCID. Pas Financements, qui viendra de Synchro Recherche. */
  orcid: boolean;
}

const PRESENTATION_TAB: ProfileTab = { id: 'presentation', label: 'papyrus.person.page.tab.presentation', orcid: true };
const WORKS_TAB: ProfileTab = { id: 'works', label: 'papyrus.person.page.tab.works', orcid: true };
const FUNDINGS_TAB: ProfileTab = { id: 'fundings', label: 'papyrus.person.page.tab.fundings', orcid: false };
const SUPERVISION_TAB: ProfileTab = { id: 'supervision', label: 'papyrus.person.page.tab.supervision', orcid: false };
const PUBLICATIONS_TAB: ProfileTab = { id: 'publications', label: 'papyrus.person.page.tab.papyrus', orcid: false };

/**
 * Fiche Person en onglets : Présentation, Travaux et Financements viennent d'ORCID,
 * Encadrement et Publications des relations Papyrus. Un onglet sans contenu n'est pas affiché,
 * sauf Publications dans Papyrus, toujours présent avec un message s'il est vide.
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
    ThemedLoadingComponent,
    ThemedThumbnailComponent,
    TranslateModule,
  ],
})
export class PersonComponent extends BaseComponent implements OnInit, AfterViewChecked {

  /** Premier onglet disponible tant que l'utilisateur n'en a pas choisi un autre. */
  activeTab: ProfileTabId;

  /** Émis une fois les données ORCID et l'encadrement connus, pour ne pas faire bouger la barre. */
  tabs$: Observable<ProfileTab[]>;

  /** Publications et directions de recherche chargées par lot de 10 (5 par défaut dans le cœur). */
  readonly relatedItemsPageSize = 10;

  private readonly elementRef: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly dsoNameService = inject(DSONameService);
  private readonly orcidService = inject(OrcidPublicApiService);
  private readonly relationshipService = inject(RelationshipDataService);
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
    this.tabs$ = combineLatest([this.loadOrcidProfile(), this.hasSupervision()]).pipe(
      map(([profile, hasSupervision]) => [
        ...(hasPresentationContent(profile) ? [PRESENTATION_TAB] : []),
        ...(profile?.works.length > 0 ? [WORKS_TAB] : []),
        ...(profile?.fundings.length > 0 ? [FUNDINGS_TAB] : []),
        ...(hasSupervision ? [SUPERVISION_TAB] : []),
        PUBLICATIONS_TAB,
      ]),
      tap((tabs) => this.activeTab ??= tabs[0].id),
    );

    this.setPageTitle();
    // HeadTagService remet le titre DSpace à chaque NavigationEnd. Abonné après lui, on passe en dernier.
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(() => this.setPageTitle());
  }

  /**
   * Message « aucune publication » si tous les ds-related-items de l'onglet sont masqués (d-none) :
   * lecture du DOM car RelationshipDataService ne se résolvait pas à temps (SSR/client).
   */
  ngAfterViewChecked(): void {
    const panel = this.elementRef.nativeElement.querySelector<HTMLElement>('.papyrus-panel');
    const message = panel?.querySelector<HTMLElement>('.papyrus-empty-message');
    if (!message) {
      return;
    }
    const hasVisibleContent = panel.querySelectorAll('.simple-view-element:not(.d-none)').length > 0;
    message.classList.toggle('d-none', hasVisibleContent);
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

  /** Une seule relation suffit pour savoir s'il y a de l'encadrement. */
  private hasSupervision(): Observable<boolean> {
    const options = Object.assign(new FindListOptions(), { elementsPerPage: 1 });
    return this.relationshipService.getItemRelationshipsByLabel(this.object, 'isPublicationOfAdvisor', options).pipe(
      getFirstCompletedRemoteData(),
      map((rd) => rd.hasSucceeded && rd.payload?.totalElements > 0),
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
