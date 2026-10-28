import {
  AsyncPipe,
  NgTemplateOutlet,
} from '@angular/common';
import {
  Component,
  OnInit,
} from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

import { SearchConfigurationService } from '../../../../app/core/shared/search/search-configuration.service';
import { SEARCH_CONFIG_SERVICE } from '../../../../app/my-dspace-page/my-dspace-configuration.service';
import { ConfigurationSearchPageComponent as BaseComponent } from '../../../../app/search-page/configuration-search-page.component';
import { pushInOut } from '../../../../app/shared/animations/push';
import { SearchLabelsComponent } from '../../../../app/shared/search/search-labels/search-labels.component';
import { ThemedSearchResultsComponent } from '../../../../app/shared/search/search-results/themed-search-results.component';
import { ThemedSearchSidebarComponent } from '../../../../app/shared/search/search-sidebar/themed-search-sidebar.component';
import { ThemedSearchFormComponent } from '../../../../app/shared/search-form/themed-search-form.component';
import { PageWithSidebarComponent } from '../../../../app/shared/sidebar/page-with-sidebar.component';
import { ViewModeSwitchComponent } from '../../../../app/shared/view-mode-switch/view-mode-switch.component';

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
      useClass: SearchConfigurationService,
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
    super.ngOnInit();
    // Forcé ici : ThemedComponent recopie toutes les entrées (même non définies), écrasant une valeur par défaut.
    this.showScopeSelector = false;
  }
}
