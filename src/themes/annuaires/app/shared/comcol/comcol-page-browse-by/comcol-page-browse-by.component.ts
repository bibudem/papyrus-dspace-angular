import { AsyncPipe } from '@angular/common';
import {
  Component,
  Inject,
  OnInit,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  EventType,
  NavigationEnd,
  Router,
  RouterLink,
  Scroll,
} from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { combineLatest } from 'rxjs';
import {
  distinctUntilChanged,
  filter,
  map,
  startWith,
  take,
} from 'rxjs/operators';

import { getCollectionPageRoute } from '../../../../../../app/collection-page/collection-page-routing-paths';
import { getCommunityPageRoute } from '../../../../../../app/community-page/community-page-routing-paths';
import { BrowseService } from '../../../../../../app/core/browse/browse.service';
import { PaginatedList } from '../../../../../../app/core/data/paginated-list.model';
import { RemoteData } from '../../../../../../app/core/data/remote-data';
import { BrowseDefinition } from '../../../../../../app/core/shared/browse-definition.model';
import { getFirstCompletedRemoteData } from '../../../../../../app/core/shared/operators';
import {
  ComcolPageBrowseByComponent as BaseComponent,
  ComColPageNavOption,
} from '../../../../../../app/shared/comcol/comcol-page-browse-by/comcol-page-browse-by.component';
import { isNotEmpty } from '../../../../../../app/shared/empty.util';
import {
  APP_CONFIG,
  AppConfig,
} from '../../../../../../config/app-config.interface';

/**
 * Onglets « Parcourir » masqués : peu pertinents pour un annuaire de personnes/unités (filtrage côté client,
 * backend hors de notre contrôle). Id = "browse_" + id de GET /server/api/discover/browses.
 */
const HIDDEN_OPTION_IDS = [
  'browse_advisor',
  'browse_dateissued',
  'browse_author',
  'browse_discipline',
  'browse_affiliation',
];

/** Libellés propres à l'annuaire, pour ne pas toucher aux clés i18n partagées avec le reste du site. */
const RELABELED_OPTIONS: Readonly<Record<string, string>> = {
  comcols: 'papyrus.annuaires.browse.units',
  browse_title: 'papyrus.annuaires.browse.names',
  browse_subject: 'papyrus.annuaires.browse.keywords',
};

/**
 * Barre d'onglets « Parcourir » de l'annuaire : masque et renomme certains onglets.
 */
@Component({
  selector: 'ds-base-comcol-page-browse-by',
  styleUrls: ['../../../../../../app/shared/comcol/comcol-page-browse-by/comcol-page-browse-by.component.scss'],
  templateUrl: '../../../../../../app/shared/comcol/comcol-page-browse-by/comcol-page-browse-by.component.html',
  imports: [
    AsyncPipe,
    FormsModule,
    RouterLink,
    TranslateModule,
  ],
})
export class ComcolPageBrowseByComponent extends BaseComponent implements OnInit {

  constructor(
    @Inject(APP_CONFIG) appConfig: AppConfig,
    router: Router,
    private browseServiceRef: BrowseService,
  ) {
    super(appConfig, router, browseServiceRef);
  }

  /** Copie de ngOnInit de la classe de base, avec filtrage et renommage des onglets dans `allOptions$`. */
  ngOnInit(): void {
    this.allOptions$ = this.browseServiceRef.getBrowseDefinitions().pipe(
      getFirstCompletedRemoteData(),
      map((browseDefListRD: RemoteData<PaginatedList<BrowseDefinition>>) => {
        const allOptions: ComColPageNavOption[] = [];
        if (browseDefListRD.hasSucceeded) {
          let comColRoute: string;
          if (this.contentType === 'collection') {
            comColRoute = getCollectionPageRoute(this.id);
            allOptions.push({
              id: 'search',
              label: 'collection.page.browse.search.head',
              routerLink: `${comColRoute}/search`,
            });
          } else if (this.contentType === 'community') {
            comColRoute = getCommunityPageRoute(this.id);
            allOptions.push({
              id: 'search',
              label: 'collection.page.browse.search.head',
              routerLink: `${comColRoute}/search`,
            });
            allOptions.push({
              id: 'comcols',
              label: 'community.all-lists.head',
              routerLink: `${comColRoute}/subcoms-cols`,
            });
          }

          allOptions.push(...browseDefListRD.payload.page.map((config: BrowseDefinition) => ({
            id: `browse_${config.id}`,
            label: `browse.comcol.by.${config.id}`,
            routerLink: `${comColRoute}/browse/${config.id}`,
          })));

          // Onglet « Recherche » déplacé en fin de barre s'il n'est pas l'onglet par défaut (comme le cœur).
          if (this.appConfig[this.contentType].defaultBrowseTab !== 'search') {
            allOptions.push(allOptions.shift());
          }
        }
        return allOptions
          .filter((option) => !HIDDEN_OPTION_IDS.includes(option.id))
          .map((option) => RELABELED_OPTIONS[option.id]
            ? { ...option, label: RELABELED_OPTIONS[option.id] }
            : option,
          );
      }),
    );

    let comColRoute: string;
    if (this.contentType === 'collection') {
      comColRoute = getCollectionPageRoute(this.id);
    } else if (this.contentType === 'community') {
      comColRoute = getCommunityPageRoute(this.id);
    }

    this.subs.push(combineLatest([
      this.allOptions$,
      this.router.events.pipe(
        startWith(this.router),
        filter((next: Router|Scroll) => (isNotEmpty((next as Router)?.url) || (next as Scroll)?.type === EventType.Scroll)),
        map((next: Router|Scroll) => (next as Router)?.url || ((next as Scroll).routerEvent as NavigationEnd).urlAfterRedirects),
        distinctUntilChanged(),
      ),
    ]).subscribe(([navOptions, url]: [ComColPageNavOption[], string]) => {
      for (const option of navOptions) {
        if (url?.split('?')[0] === comColRoute && option.id === this.appConfig[this.contentType].defaultBrowseTab) {
          void this.router.navigate([option.routerLink], { queryParams: option.params, replaceUrl: true });
          break;
        } else if (option.routerLink === url?.split('?')[0]) {
          this.currentOption$.next(option);
          break;
        }
      }
    }));

    if (this.router.url?.split('?')[0] === comColRoute) {
      this.allOptions$.pipe(
        take(1),
      ).subscribe((allOptions: ComColPageNavOption[]) => {
        for (const option of allOptions) {
          if (option.id === this.appConfig[this.contentType].defaultBrowseTab) {
            this.currentOption$.next(option[0]);
            void this.router.navigate([option.routerLink], { queryParams: option.params });
            break;
          }
        }
      });
    }
  }
}
