import {
  AsyncPipe,
  NgTemplateOutlet,
} from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
} from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

import { pushInOut } from '../../../../../app/shared/animations/push';
import { SearchComponent as BaseComponent } from '../../../../../app/shared/search/search.component';
import { SearchLabelsComponent } from '../../../../../app/shared/search/search-labels/search-labels.component';
import { ThemedSearchResultsComponent } from '../../../../../app/shared/search/search-results/themed-search-results.component';
import { ThemedSearchSidebarComponent } from '../../../../../app/shared/search/search-sidebar/themed-search-sidebar.component';
import { ThemedSearchFormComponent } from '../../../../../app/shared/search-form/themed-search-form.component';
import { PageWithSidebarComponent } from '../../../../../app/shared/sidebar/page-with-sidebar.component';
import { ViewModeSwitchComponent } from '../../../../../app/shared/view-mode-switch/view-mode-switch.component';

export const ANNUAIRES_SEARCH_PLACEHOLDER = 'papyrus.annuaires.search-form.placeholder';

/**
 * Recherche du répertoire : placeholder propre au répertoire plutôt que « Rechercher dans Papyrus ».
 */
@Component({
  selector: 'ds-themed-search',
  styleUrls: ['../../../../../app/shared/search/search.component.scss'],
  templateUrl: '../../../../../app/shared/search/search.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [pushInOut],
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
})
export class SearchComponent extends BaseComponent implements OnInit {
  ngOnInit(): void {
    // ThemedComponent recopie aussi les entrées non définies, ce qui efface la valeur par défaut.
    // Un placeholder explicite passé par le parent est conservé.
    if (!this.searchFormPlaceholder || this.searchFormPlaceholder === 'search.search-form.placeholder') {
      this.searchFormPlaceholder = ANNUAIRES_SEARCH_PLACEHOLDER;
    }
    super.ngOnInit();
  }
}
