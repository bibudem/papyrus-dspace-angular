import {
  AsyncPipe,
  NgTemplateOutlet,
} from '@angular/common';
import {
  Component,
  OnInit,
} from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

import {
  SortDirection,
  SortOptions,
} from '../../../../app/core/cache/models/sort-options.model';
import { ViewMode } from '../../../../app/core/shared/view-mode.model';
import { SEARCH_CONFIG_SERVICE } from '../../../../app/my-dspace-page/my-dspace-configuration.service';
import { ConfigurationSearchPageComponent as BaseComponent } from '../../../../app/search-page/configuration-search-page.component';
import { pushInOut } from '../../../../app/shared/animations/push';
import { SearchLabelsComponent } from '../../../../app/shared/search/search-labels/search-labels.component';
import { ThemedSearchResultsComponent } from '../../../../app/shared/search/search-results/themed-search-results.component';
import { ThemedSearchSidebarComponent } from '../../../../app/shared/search/search-sidebar/themed-search-sidebar.component';
import { ThemedSearchFormComponent } from '../../../../app/shared/search-form/themed-search-form.component';
import { PageWithSidebarComponent } from '../../../../app/shared/sidebar/page-with-sidebar.component';
import { ViewModeSwitchComponent } from '../../../../app/shared/view-mode-switch/view-mode-switch.component';
import { ANNUAIRES_SEARCH_PLACEHOLDER } from '../shared/search/search.component';
import { DefaultSortSearchConfigurationService } from './default-sort-search-configuration.service';

/** Publications d'une fiche (ds-tabbed-related-entities-search) : affichées en liste seulement. */
const LIST_ONLY_CONFIGURATIONS = ['default-relationships'];

/** Tri par défaut à la place du premier tri du backend (pertinence) : publications les plus récentes d'abord. */
const DEFAULT_SORTS: Record<string, SortOptions> = {
  'default-relationships': new SortOptions('dc.date.issued', SortDirection.DESC),
};

/**
 * Recherche embarquée dans une fiche (ex. professeur·es d'une unité) : masque le sélecteur de portée
 * pour que la recherche reste limitée à la relation en cours.
 */
@Component({
  selector: 'ds-themed-configuration-search-page',
  styleUrls: ['../../../../app/shared/search/search.component.scss'],
  templateUrl: '../../../../app/shared/search/search.component.html',
  // Les providers ne sont pas hérités de la classe de base : sans eux, erreur NG0201.
  providers: [
    {
      provide: SEARCH_CONFIG_SERVICE,
      useClass: DefaultSortSearchConfigurationService,
    },
  ],
  imports: [
    AsyncPipe,
    NgTemplateOutlet,
    PageWithSidebarComponent,
    SearchLabelsComponent,
    ThemedSearchFormComponent,
    ThemedSearchResultsComponent,
    ThemedSearchSidebarComponent,
    TranslateModule,
    ViewModeSwitchComponent,
  ],
  animations: [pushInOut],
})
export class ConfigurationSearchPageComponent extends BaseComponent implements OnInit {
  ngOnInit(): void {
    // Avant super.ngOnInit(), qui lit les tris de la configuration.
    if (this.searchConfigService instanceof DefaultSortSearchConfigurationService) {
      this.searchConfigService.defaultSort = DEFAULT_SORTS[this.configuration] ?? null;
    }
    super.ngOnInit();
    // Forcé ici : ThemedComponent recopie toutes les entrées (même non définies), écrasant une valeur par défaut.
    this.showScopeSelector = false;
    if (LIST_ONLY_CONFIGURATIONS.includes(this.configuration)) {
      this.showViewModes = false;
      this.viewModeList = [ViewMode.ListElement];
    }
    if (!this.searchFormPlaceholder || this.searchFormPlaceholder === 'search.search-form.placeholder') {
      this.searchFormPlaceholder = ANNUAIRES_SEARCH_PLACEHOLDER;
    }
  }
}
