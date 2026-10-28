import { Component } from '@angular/core';

import { Context } from '../../../../../../../app/core/shared/context.model';
import { Item } from '../../../../../../../app/core/shared/item.model';
import { ViewMode } from '../../../../../../../app/core/shared/view-mode.model';
import { listableObjectComponent } from '../../../../../../../app/shared/object-collection/shared/listable-object/listable-object.decorator';
import { AbstractListableElementComponent } from '../../../../../../../app/shared/object-collection/shared/object-collection-element/abstract-listable-element.component';
import { PersonSearchResultListElementComponent } from '../../item-list-elements/search-result-list-elements/person/person-search-result-list-element.component';

/**
 * Person hors recherche (browse, relations) : le cœur importe en dur sa propre carte de résultat
 * (sans résolution par thème) ; on importe la nôtre pour avoir la même carte que dans la recherche.
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
