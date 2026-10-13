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

import {
  APP_CONFIG,
  AppConfig,
} from '../../../../../../config/app-config.interface';
import { RemoteData } from '../../../../../../app/core/data/remote-data';
import { SearchService } from '../../../../../../app/core/shared/search/search.service';
import { SearchConfigurationService } from '../../../../../../app/core/shared/search/search-configuration.service';
import { SearchFilterService } from '../../../../../../app/core/shared/search/search-filter.service';
import { SEARCH_CONFIG_SERVICE } from '../../../../../../app/my-dspace-page/my-dspace-configuration.service';
import { currentPath } from '../../../../../../app/shared/utils/route.utils';
import { AppliedFilter } from '../../../../../../app/shared/search/models/applied-filter.model';
import { SearchFilterConfig } from '../../../../../../app/shared/search/models/search-filter-config.model';
import { SearchFilterComponent } from '../../../../../../app/shared/search/search-filters/search-filter/search-filter.component';

/**
 * Thème "annuaires" : masque les filtres "Type" (facette REST `itemtype`) et "Type d'accès"
 * (`access_status`), pas pertinents pour parcourir un annuaire de personnes/unités
 * académiques. Backend hors de notre contrôle, donc filtré côté client.
 *
 * Ne fait pas `extends SearchFiltersComponent` : TypeScript interdit de transformer une
 * propriété héritée (`filters`) en accesseur (TS2611), et `currentFiltersComputed`/
 * `finalFiltersComputed` sont `private` dans la classe de base (TS2415 si redéclarés).
 * La classe est donc dupliquée ici ; `filters` filtre son payload à la source, ce qui garde
 * le compteur "skeleton loader" cohérent (il lit `this.filters`, déjà filtré).
 *
 * Pour masquer un autre filtre : ajouter son nom de facette (GET /server/api/discover/facets)
 * à HIDDEN_FACET_NAMES.
 */
const HIDDEN_FACET_NAMES = ['itemtype', 'access_status'];

/**
 * Renomme l'intitulé affiché de certains filtres conservés, sans toucher à la clé i18n
 * partagée `search.filters.filter.<name>.head` (utilisée ailleurs sur tout le site).
 *
 * IMPORTANT — pourquoi ceci n'est PAS un simple remappage de label comme pour les onglets
 * "Parcourir" (ComcolPageBrowseByComponent) : le libellé "Sujet" est généré à l'intérieur du
 * template de SearchFilterComponent (cœur DSpace), qui n'a pas de variante "Themed" — donc
 * pas de point d'extension propre. `filter.name` ('subject') sert AUSSI de nom de facette
 * REST réel (paramètre d'URL `f.subject=...`) : le renommer casserait le filtrage. On corrige
 * donc le texte affiché après coup, directement dans le DOM (voir relabelFilterHeadings), ce
 * qui laisse l'attribut aria-label du bouton (calculé par le cœur) dire encore "sujet" — un
 * décalage d'accessibilité accepté en connaissance de cause, faute de mieux sans toucher au
 * cœur ou au reste du site.
 */
const RELABELED_FACET_NAMES: Readonly<Record<string, string>> = {
  subject: 'papyrus.annuaires.browse.keywords',
};

@Component({
  selector: 'ds-base-search-filters',
  styleUrls: ['../../../../../../app/shared/search/search-filters/search-filters.component.scss'],
  templateUrl: '../../../../../../app/shared/search/search-filters/search-filters.component.html',
  standalone: true,
  imports: [
    AsyncPipe,
    NgxSkeletonLoaderModule,
    RouterLink,
    SearchFilterComponent,
    TranslateModule,
  ],
})
export class SearchFiltersComponent implements OnInit, AfterViewChecked {
  private _filters: Observable<RemoteData<SearchFilterConfig[]>>;

  /**
   * An observable containing configuration about which filters are shown and how they are shown.
   * Filtré (voir HIDDEN_FACET_NAMES) : le reste de la classe (compteurs, template) consomme
   * cette version déjà filtrée, donc reste cohérent.
   */
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

  /**
   * List of all filters that are currently active with their value set to null.
   * Used to reset all filters at once
   */
  clearParams;

  /**
   * The configuration to use for the search options
   */
  @Input() currentConfiguration;

  /**
   * The current search scope
   */
  @Input() currentScope: string;

  /**
   * True when the search component should show results on the current page
   */
  @Input() inPlaceSearch;

  /**
   * Emits when the search filters values may be stale, and so they must be refreshed.
   */
  @Input() refreshFilters: BehaviorSubject<boolean>;

  appliedFilters: Map<string, AppliedFilter[]> = new Map();

  /**
   * Link to the search page
   */
  searchLink: string;

  /**
   * Keeps track of the filters computed for each configuration during the current rendering cycle
   * This array stores objects with configuration identifier and number of computed filters
   */
  private currentFiltersComputed = [];

  /**
   * Stores the final count of computed filters for each configuration
   * Used to determine when all filters for a configuration have been processed
   */
  private finalFiltersComputed = [];

  subs = [];
  filterLabel = 'search';
  defaultFilterCount: number;

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

  /**
   * Corrige après coup le texte affiché de certains intitulés de filtre (voir
   * RELABELED_FACET_NAMES) — relancé à chaque cycle de détection des changements (peu
   * coûteux : une poignée d'éléments DOM tout au plus) pour rester correct même si la liste
   * de filtres se recharge.
   */
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

  /**
   * @returns {string} The base path to the search page, or the current page when inPlaceSearch is true
   */
  getSearchLink(): string {
    if (this.inPlaceSearch) {
      return currentPath(this.router);
    }
    return this.searchService.getSearchLink();
  }

  /**
   * Prevent unnecessary rerendering
   */
  trackUpdate(index, config: SearchFilterConfig) {
    return config ? config.name : undefined;
  }

  minimizeFilters(): void {
    if (this.searchService.appliedFilters$.value.length > 0) {
      this.searchFilterService.minimizeAll();
    }
  }

  countFiltersWithComputedVisibility(computed: boolean) {
    if (computed) {
      this.filters.pipe(
        // Get filter data and check if we need to increment the counter
        map(filtersData => {
          if (filtersData && filtersData.hasSucceeded && filtersData.payload) {
            const totalFilters = filtersData.payload.length;
            const currentComputed = this.getCurrentFiltersComputed(this.currentConfiguration);

            // If we've already computed all filters for this configuration
            if (currentComputed >= totalFilters) {
              // Register in finalFiltersComputed if not already registered
              if (!this.findConfigInFinalFilters(this.currentConfiguration)) {
                this.updateFinalFiltersComputed(this.currentConfiguration, totalFilters);
              }
              return { shouldIncrement: false };
            }

            // We haven't reached the total yet, proceed with increment
            return {
              shouldIncrement: true,
              totalFilters,
            };
          }
          return { shouldIncrement: false };
        }),
        // Only continue if we need to increment the counter
        filter(result => result.shouldIncrement),
        // Increment the counter for the current configuration
        map(result => {
          const filterConfig = this.findConfigInCurrentFilters(this.currentConfiguration);

          if (filterConfig) {
            // Update existing counter
            filterConfig.filtersComputed += 1;
          } else {
            // Create new counter entry
            this.currentFiltersComputed.push({
              configuration: this.currentConfiguration,
              filtersComputed: 1,
            });
          }

          // Pass along the total and updated count
          return {
            totalFilters: result.totalFilters,
            currentComputed: this.getCurrentFiltersComputed(this.currentConfiguration),
          };
        }),
        // Check if we've reached the total after incrementing
        map(result => {
          if (result.currentComputed === result.totalFilters) {
            // If we've reached the total, update final filters count
            this.updateFinalFiltersComputed(this.currentConfiguration, result.currentComputed);
          }
          return result;
        }),
      ).pipe(take(1)).subscribe(); // Execute the pipeline once and complete
    }
  }

  /**
   * Finds a configuration entry in the currentFiltersComputed array
   * @param configuration The configuration identifier to search for
   * @returns The filter configuration object if found, otherwise undefined
   */
  private findConfigInCurrentFilters(configuration: string) {
    return this.currentFiltersComputed.find(
      (configFilter) => configFilter.configuration === configuration,
    );
  }

  /**
   * Finds a configuration entry in the finalFiltersComputed array
   * @param configuration The configuration identifier to search for
   * @returns The filter configuration object if found, otherwise undefined
   */
  private findConfigInFinalFilters(configuration: string) {
    return this.finalFiltersComputed.find(
      (configFilter) => configFilter.configuration === configuration,
    );
  }

  /**
   * Updates or adds a new entry in the finalFiltersComputed array
   * @param configuration The configuration identifier to update
   * @param count The number of computed filters to set for this configuration
   */
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

  /**
   * Gets the current number of computed filters for a specific configuration
   * @param configuration The configuration identifier to get the count for
   * @returns The number of computed filters, or 0 if none found
   */
  getCurrentFiltersComputed(configuration: string): number {
    const configFilter = this.findConfigInCurrentFilters(configuration);
    return configFilter?.filtersComputed || 0;
  }
}
