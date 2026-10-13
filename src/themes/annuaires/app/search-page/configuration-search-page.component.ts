import {
  AsyncPipe,
  NgTemplateOutlet,
} from '@angular/common';
import { Component } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

import { pushInOut } from '../../../../app/shared/animations/push';
import { SearchConfigurationService } from '../../../../app/core/shared/search/search-configuration.service';
import { SEARCH_CONFIG_SERVICE } from '../../../../app/my-dspace-page/my-dspace-configuration.service';
import { ConfigurationSearchPageComponent as BaseComponent } from '../../../../app/search-page/configuration-search-page.component';
import { SearchLabelsComponent } from '../../../../app/shared/search/search-labels/search-labels.component';
import { ThemedSearchResultsComponent } from '../../../../app/shared/search/search-results/themed-search-results.component';
import { ThemedSearchSidebarComponent } from '../../../../app/shared/search/search-sidebar/themed-search-sidebar.component';
import { ThemedSearchFormComponent } from '../../../../app/shared/search-form/themed-search-form.component';
import { PageWithSidebarComponent } from '../../../../app/shared/sidebar/page-with-sidebar.component';
import { ViewModeSwitchComponent } from '../../../../app/shared/view-mode-switch/view-mode-switch.component';

/**
 * Thème "annuaires" : recherche embarquée dans un item (ex. "Professeur-es de l'unité" sur la
 * fiche OrgUnit, via ds-tabbed-related-entities-search) — masque le bouton de sélection de
 * portée ("Tout Papyrus"), qui permettrait d'élargir la recherche hors de la relation en
 * cours alors qu'elle doit rester cantonnée à cette liste précise.
 *
 * Comme pour searchFormPlaceholder (cf. historique) : le composant appelant ne passe pas
 * `[showScopeSelector]`, et le mécanisme de thème (ThemedComponent) recopie systématiquement
 * toutes les valeurs d'entrée (même "non définies") par-dessus celles de l'instance — un
 * simple changement de valeur par défaut serait donc écrasé. On corrige après coup, dans
 * ngOnInit.
 */
@Component({
  selector: 'ds-themed-configuration-search-page',
  styleUrls: ['../../../../app/shared/search/search.component.scss'],
  templateUrl: '../../../../app/shared/search/search.component.html',
  standalone: true,
  // Obligatoire : les "providers" d'un @Component ne sont pas hérités de la classe de base
  // (contrairement aux autres métadonnées) — sans ça, SEARCH_CONFIG_SERVICE n'est pas
  // fourni à l'injecteur de ce composant et l'instanciation échoue (NG0201).
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
export class ConfigurationSearchPageComponent extends BaseComponent {
  ngOnInit(): void {
    super.ngOnInit();
    this.showScopeSelector = false;
  }
}
