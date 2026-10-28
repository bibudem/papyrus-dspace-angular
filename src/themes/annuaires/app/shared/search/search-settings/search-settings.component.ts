import {
  Component,
  Input,
} from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

import { SortOptions } from '../../../../../../app/core/cache/models/sort-options.model';
import { PageSizeSelectorComponent } from '../../../../../../app/shared/page-size-selector/page-size-selector.component';

/**
 * Paramètres de recherche de l'annuaire : retire « Trier par », seul « Résultats par page » reste.
 * Pas d'`extends` (cf. search-filters) ; les @Input de tri restent car le parent les lie toujours.
 */
@Component({
  selector: 'ds-base-search-settings',
  templateUrl: './search-settings.component.html',
  imports: [
    PageSizeSelectorComponent,
    TranslateModule,
  ],
})
export class SearchSettingsComponent {
  @Input() sortOptionsList: SortOptions[];
  @Input() currentSortOption: SortOptions;
}
