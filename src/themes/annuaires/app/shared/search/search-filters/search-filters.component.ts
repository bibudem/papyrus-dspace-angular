import { AsyncPipe } from '@angular/common';
import {
  AfterViewChecked,
  Component,
  ElementRef,
  Inject,
  Input,
  OnInit,
} from '@angular/core';
import {
  Router,
  RouterLink,
} from '@angular/router';
import {
  TranslateModule,
  TranslateService,
} from '@ngx-translate/core';
import { NgxSkeletonLoaderModule } from 'ngx-skeleton-loader';
import {
  BehaviorSubject,
  Observable,
} from 'rxjs';
import {
  filter,
  map,
  take,
} from 'rxjs/operators';

import { RemoteData } from '../../../../../../app/core/data/remote-data';
import { SearchService } from '../../../../../../app/core/shared/search/search.service';
import { SearchConfigurationService } from '../../../../../../app/core/shared/search/search-configuration.service';
import { SearchFilterService } from '../../../../../../app/core/shared/search/search-filter.service';
import { SEARCH_CONFIG_SERVICE } from '../../../../../../app/my-dspace-page/my-dspace-configuration.service';
import { AppliedFilter } from '../../../../../../app/shared/search/models/applied-filter.model';
import { SearchFilterConfig } from '../../../../../../app/shared/search/models/search-filter-config.model';
import { SearchFilterComponent } from '../../../../../../app/shared/search/search-filters/search-filter/search-filter.component';
import { currentPath } from '../../../../../../app/shared/utils/route.utils';
import {
  APP_CONFIG,
  AppConfig,
} from '../../../../../../config/app-config.interface';

/** Facettes masquées (noms de GET /server/api/discover/facets), peu pertinentes pour un annuaire. */
const HIDDEN_FACET_NAMES = ['itemtype', 'access_status'];

/**
 * Intitulés de filtre renommés (facette → clé i18n). Fait dans le DOM (cf. ngAfterViewChecked) : le libellé
 * vient de SearchFilterComponent, non thémable, et `filter.name` sert aussi de paramètre d'URL.
 * L'aria-label calculé par le cœur garde l'ancien libellé (décalage accepté).
 */
const RELABELED_FACET_NAMES: Readonly<Record<string, string>> = {
  subject: 'papyrus.annuaires.browse.keywords',
};

/**
 * Filtres de recherche de l'annuaire : masque et renomme certains filtres.
 * Copie de la classe du cœur plutôt qu'un `extends` : `filters` devient un accesseur (TS2611) et
 * les compteurs privés de la base ne peuvent être redéclarés (TS2415).
 */
@Component({
  selector: 'ds-base-search-filters',
  styleUrls: ['../../../../../../app/shared/search/search-filters/search-filters.component.scss'],
  templateUrl: '../../../../../../app/shared/search/search-filters/search-filters.component.html',
  imports: [
    AsyncPipe,
    NgxSkeletonLoaderModule,
    RouterLink,
    SearchFilterComponent,
    TranslateModule,
  ],
})
export class SearchFiltersComponent implements OnInit, AfterViewChecked {
  /** Configuration des filtres affichés, filtrée à la source pour que compteurs et template restent cohérents. */
  @Input()
  set filters(value: Observable<RemoteData<SearchFilterConfig[]>>) {
    this._filters = value?.pipe(
      map((rd: RemoteData<SearchFilterConfig[]>) => {
        if (rd?.hasSucceeded && rd.payload) {
          rd.payload = rd.payload.filter((f) => !HIDDEN_FACET_NAMES.includes(f.name));
        }
        return rd;
      }),
    );
  }

  get filters(): Observable<RemoteData<SearchFilterConfig[]>> {
    return this._filters;
  }

  /** Configuration de recherche courante. */
  @Input() currentConfiguration;

  /** Portée de recherche courante. */
  @Input() currentScope: string;

  /** Vrai si les résultats s'affichent sur la page courante. */
  @Input() inPlaceSearch;

  /** Émet quand les valeurs des filtres doivent être rafraîchies. */
  @Input() refreshFilters: BehaviorSubject<boolean>;

  /** Filtres actifs remis à null, pour tout réinitialiser d'un coup. */
  clearParams;

  appliedFilters: Map<string, AppliedFilter[]> = new Map();

  /** Lien vers la page de recherche. */
  searchLink: string;

  subs = [];
  filterLabel = 'search';
  defaultFilterCount: number;

  private _filters: Observable<RemoteData<SearchFilterConfig[]>>;

  /** Nombre de filtres calculés par configuration pendant le rendu courant. */
  private currentFiltersComputed = [];

  /** Nombre final de filtres calculés par configuration. */
  private finalFiltersComputed = [];

  constructor(
    protected searchService: SearchService,
    protected searchFilterService: SearchFilterService,
    protected router: Router,
    @Inject(SEARCH_CONFIG_SERVICE) protected searchConfigService: SearchConfigurationService,
    @Inject(APP_CONFIG) protected appConfig: AppConfig,
    private elementRef: ElementRef<HTMLElement>,
    private translateService: TranslateService,
  ) {
    this.defaultFilterCount = this.appConfig.search.filterPlaceholdersCount ?? 5;
  }

  ngOnInit(): void {
    if (!this.inPlaceSearch) {
      this.filterLabel = 'discover';
    }
    this.clearParams = this.searchConfigService.getCurrentFrontendFilters().pipe(map((filters) => {
      Object.keys(filters).forEach((f) => filters[f] = null);
      return filters;
    }));
    this.searchLink = this.getSearchLink();
  }

  /** Renomme les intitulés (RELABELED_FACET_NAMES) à chaque cycle, pour survivre aux rechargements de la liste. */
  ngAfterViewChecked(): void {
    const headings = this.elementRef.nativeElement.querySelectorAll<HTMLElement>('.filter-name .h4');
    headings.forEach((heading) => {
      for (const [facetName, labelKey] of Object.entries(RELABELED_FACET_NAMES)) {
        const original = this.translateService.instant(`search.filters.filter.${facetName}.head`);
        if (heading.textContent?.trim() === original) {
          const replacement = this.translateService.instant(labelKey);
          if (heading.textContent !== replacement) {
            heading.textContent = replacement;
          }
          break;
        }
      }
    });
  }

  /** Chemin de la page de recherche, ou de la page courante si inPlaceSearch. */
  getSearchLink(): string {
    if (this.inPlaceSearch) {
      return currentPath(this.router);
    }
    return this.searchService.getSearchLink();
  }

  /** Évite les re-rendus inutiles. */
  trackUpdate(index, config: SearchFilterConfig) {
    return config ? config.name : undefined;
  }

  minimizeFilters(): void {
    if (this.searchService.appliedFilters$.value.length > 0) {
      this.searchFilterService.minimizeAll();
    }
  }

  /** Compte, par configuration, les filtres dont la visibilité est calculée (repris du cœur). */
  countFiltersWithComputedVisibility(computed: boolean) {
    if (computed) {
      this.filters.pipe(
        map(filtersData => {
          if (filtersData && filtersData.hasSucceeded && filtersData.payload) {
            const totalFilters = filtersData.payload.length;
            const currentComputed = this.getCurrentFiltersComputed(this.currentConfiguration);

            // Tous les filtres déjà comptés : on enregistre le total final une seule fois.
            if (currentComputed >= totalFilters) {
              if (!this.findConfigInFinalFilters(this.currentConfiguration)) {
                this.updateFinalFiltersComputed(this.currentConfiguration, totalFilters);
              }
              return { shouldIncrement: false };
            }

            return {
              shouldIncrement: true,
              totalFilters,
            };
          }
          return { shouldIncrement: false };
        }),
        filter(result => result.shouldIncrement),
        map(result => {
          const filterConfig = this.findConfigInCurrentFilters(this.currentConfiguration);

          if (filterConfig) {
            filterConfig.filtersComputed += 1;
          } else {
            this.currentFiltersComputed.push({
              configuration: this.currentConfiguration,
              filtersComputed: 1,
            });
          }

          return {
            totalFilters: result.totalFilters,
            currentComputed: this.getCurrentFiltersComputed(this.currentConfiguration),
          };
        }),
        map(result => {
          if (result.currentComputed === result.totalFilters) {
            this.updateFinalFiltersComputed(this.currentConfiguration, result.currentComputed);
          }
          return result;
        }),
      ).pipe(take(1)).subscribe();
    }
  }

  /** Nombre de filtres calculés pour une configuration (0 si aucun). */
  getCurrentFiltersComputed(configuration: string): number {
    const configFilter = this.findConfigInCurrentFilters(configuration);
    return configFilter?.filtersComputed || 0;
  }

  private findConfigInCurrentFilters(configuration: string) {
    return this.currentFiltersComputed.find(
      (configFilter) => configFilter.configuration === configuration,
    );
  }

  private findConfigInFinalFilters(configuration: string) {
    return this.finalFiltersComputed.find(
      (configFilter) => configFilter.configuration === configuration,
    );
  }

  private updateFinalFiltersComputed(configuration: string, count: number) {
    const filterConfig = this.findConfigInFinalFilters(configuration);

    if (filterConfig) {
      filterConfig.filtersComputed = count;
    } else {
      this.finalFiltersComputed.push({
        configuration,
        filtersComputed: count,
      });
    }
  }
}
