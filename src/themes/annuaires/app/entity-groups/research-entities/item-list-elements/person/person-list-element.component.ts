import { Component } from '@angular/core';

import { Context } from '../../../../../../../app/core/shared/context.model';
import { Item } from '../../../../../../../app/core/shared/item.model';
import { ViewMode } from '../../../../../../../app/core/shared/view-mode.model';
import { listableObjectComponent } from '../../../../../../../app/shared/object-collection/shared/listable-object/listable-object.decorator';
import { AbstractListableElementComponent } from '../../../../../../../app/shared/object-collection/shared/object-collection-element/abstract-listable-element.component';
import { PersonSearchResultListElementComponent } from '../../item-list-elements/search-result-list-elements/person/person-search-result-list-element.component';

/**
 * Carte Person utilisée hors contexte de recherche (ex. page "Parcourir les titres"/browse,
 * ou relation "Affiliation" sur une fiche OrgUnit) — le cœur DSpace importe en dur sa propre
 * PersonSearchResultListElementComponent ici (pas de résolution par thème), ce qui contournait
 * notre surcharge annuaires (badge "Personne" retiré). On réimporte donc la nôtre à la place —
 * même carte complète (photo, badge ORCID) que sur les pages de résultats de recherche.
 */
@listableObjectComponent('Person', ViewMode.ListElement, Context.Any, 'annuaires')
@Component({
  selector: 'ds-person-list-element',
  styleUrls: ['../../../../../../../app/entity-groups/research-entities/item-list-elements/person/person-list-element.component.scss'],
  templateUrl: './person-list-element.component.html',
  standalone: true,
  imports: [
    PersonSearchResultListElementComponent,
  ],
})
export class PersonListElementComponent extends AbstractListableElementComponent<Item> {
}
