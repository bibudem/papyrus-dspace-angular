import { Component, Input } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

import { SortOptions } from '../../../../../../app/core/cache/models/sort-options.model';
import { PageSizeSelectorComponent } from '../../../../../../app/shared/page-size-selector/page-size-selector.component';

/**
 * Thème "orcid" : retire le contrôle "Trier par", pas pertinent pour un annuaire — seul
 * "Résultats par page" reste. Backend hors de notre contrôle, donc fait côté client.
 *
 * Ne fait pas `extends SearchSettingsComponent` (même raison que search-filters.component.ts
 * du dossier voisin). `sortOptionsList`/`currentSortOption` restent en @Input() — non
 * utilisés ici, mais le parent les passe systématiquement en binding.
 */
@Component({
  selector: 'ds-base-search-settings',
  templateUrl: './search-settings.component.html',
  standalone: true,
  imports: [
    PageSizeSelectorComponent,
    TranslateModule,
  ],
})
export class SearchSettingsComponent {
  @Input() sortOptionsList: SortOptions[];
  @Input() currentSortOption: SortOptions;
}
