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
 * Carte OrgUnit utilisée hors contexte de recherche (ex. relation "Affiliation" sur la fiche
 * Person, via ds-related-items) — le cœur DSpace réutilise ici sa carte de résultat de
 * recherche complète (icône, bordure, flèche), pensée pour une page de résultats, pas pour
 * une simple ligne de relation. On affiche donc juste le titre, sans aucun habillage de carte.
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

  get name(): string {
    return this.dsoNameService.getName(this.object);
  }

  ngOnInit(): void {
    this.itemPageRoute = getItemPageRoute(this.object);
  }
}
