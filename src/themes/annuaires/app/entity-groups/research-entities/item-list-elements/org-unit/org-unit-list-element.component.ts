import { AsyncPipe } from '@angular/common';
import {
  Component,
  OnInit,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { Context } from '../../../../../../../app/core/shared/context.model';
import { Item } from '../../../../../../../app/core/shared/item.model';
import { ViewMode } from '../../../../../../../app/core/shared/view-mode.model';
import { getItemPageRoute } from '../../../../../../../app/item-page/item-page-routing-paths';
import { listableObjectComponent } from '../../../../../../../app/shared/object-collection/shared/listable-object/listable-object.decorator';
import { AbstractListableElementComponent } from '../../../../../../../app/shared/object-collection/shared/object-collection-element/abstract-listable-element.component';
import { TruncatableComponent } from '../../../../../../../app/shared/truncatable/truncatable.component';

/**
 * OrgUnit hors recherche (ex. affiliation sur la fiche Person) : simple lien sur le titre,
 * au lieu de la carte de résultat complète réutilisée par le cœur DSpace.
 */
@listableObjectComponent('OrgUnit', ViewMode.ListElement, Context.Any, 'annuaires')
@Component({
  selector: 'ds-org-unit-list-element',
  styleUrls: ['./org-unit-list-element.component.scss'],
  templateUrl: './org-unit-list-element.component.html',
  standalone: true,
  imports: [
    AsyncPipe,
    RouterLink,
    TruncatableComponent,
  ],
})
export class OrgUnitListElementComponent extends AbstractListableElementComponent<Item> implements OnInit {
  itemPageRoute: string;

  ngOnInit(): void {
    this.itemPageRoute = getItemPageRoute(this.object);
  }

  get name(): string {
    return this.dsoNameService.getName(this.object);
  }
}
