import {
  Observable,
  of,
} from 'rxjs';
import { map } from 'rxjs/operators';

import { DSpaceObjectDataService } from '../../../../app/core/data/dspace-object-data.service';
import { Collection } from '../../../../app/core/shared/collection.model';
import { getFirstCompletedRemoteData } from '../../../../app/core/shared/operators';

/**
 * Vrai si l'identifiant désigne une collection d'entités OrgUnit (« Unités académiques »).
 * Détection par le type d'entité plutôt que par UUID, pour suivre les environnements.
 */
export function isOrgUnitCollection(dsoService: DSpaceObjectDataService, id: string | undefined): Observable<boolean> {
  if (!id) {
    return of(false);
  }
  return dsoService.findById(id).pipe(
    getFirstCompletedRemoteData(),
    map((rd) => rd.hasSucceeded
      && rd.payload?.type?.value === Collection.type.value
      && rd.payload.firstMetadataValue('dspace.entity.type') === 'OrgUnit'),
  );
}
