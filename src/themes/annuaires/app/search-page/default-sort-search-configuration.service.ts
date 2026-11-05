import { Injectable } from '@angular/core';

import { SortOptions } from '../../../../app/core/cache/models/sort-options.model';
import { SearchConfigurationService } from '../../../../app/core/shared/search/search-configuration.service';
import { SearchConfig } from '../../../../app/core/shared/search/search-filters/search-config.model';

/**
 * DSpace prend comme tri par défaut le premier tri de la configuration backend. Ce service place en tête
 * le tri choisi par le composant, s'il fait partie des tris proposés ; sinon l'ordre du backend est gardé.
 * Fourni par composant : chaque recherche a son propre tri par défaut.
 */
@Injectable()
export class DefaultSortSearchConfigurationService extends SearchConfigurationService {

  defaultSort: SortOptions | null = null;

  getConfigurationSortOptions(searchConfig: SearchConfig): SortOptions[] {
    const options = super.getConfigurationSortOptions(searchConfig);
    const preferred = options.find((option) =>
      option.field === this.defaultSort?.field && option.direction === this.defaultSort?.direction);
    return preferred ? [preferred, ...options.filter((option) => option !== preferred)] : options;
  }
}
