import { AsyncPipe, NgIf } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { Context } from '../../../../../../../app/core/shared/context.model';
import { ViewMode } from '../../../../../../../app/core/shared/view-mode.model';
import { OrgUnitComponent as BaseComponent } from '../../../../../../../app/entity-groups/research-entities/item-pages/org-unit/org-unit.component';
import { GenericItemPageFieldComponent } from '../../../../../../../app/item-page/simple/field-components/specific-field/generic/generic-item-page-field.component';
import { ItemPageImgFieldComponent } from '../../../../../../../app/item-page/simple/field-components/specific-field/img/item-page-img-field.component';
import { ThemedItemPageTitleFieldComponent } from '../../../../../../../app/item-page/simple/field-components/specific-field/title/themed-item-page-field.component';
import { ItemPageUriFieldComponent } from '../../../../../../../app/item-page/simple/field-components/specific-field/uri/item-page-uri-field.component';
import { TabbedRelatedEntitiesSearchComponent } from '../../../../../../../app/item-page/simple/related-entities/tabbed-related-entities-search/tabbed-related-entities-search.component';
import { RelatedItemsComponent } from '../../../../../../../app/item-page/simple/related-items/related-items-component';
import { listableObjectComponent } from '../../../../../../../app/shared/object-collection/shared/listable-object/listable-object.decorator';
import { DsoEditMenuComponent } from '../../../../../../../app/shared/dso-page/dso-edit-menu/dso-edit-menu.component';

/**
 * Fiche OrgUnit de l'annuaire UdeM : identique à celle du thème montreal (date de fondation,
 * ville, pays, ROR, site web, liste des professeur-es de l'unité), sans la vignette (icône
 * générique peu utile pour une unité académique) ni le bouton "Retour aux résultats" — déjà
 * intégré au fil d'Ariane de ce thème (voir ../../../breadcrumbs/breadcrumbs.component.ts).
 */
@listableObjectComponent('OrgUnit', ViewMode.StandalonePage, Context.Any, 'annuaires')
@Component({
  selector: 'ds-org-unit',
  styleUrls: ['./org-unit.component.scss'],
  templateUrl: './org-unit.component.html',
  standalone: true,
  imports: [
    AsyncPipe,
    NgIf,
    RouterLink,
    TranslateModule,
    DsoEditMenuComponent,
    GenericItemPageFieldComponent,
    ItemPageImgFieldComponent,
    ItemPageUriFieldComponent,
    RelatedItemsComponent,
    TabbedRelatedEntitiesSearchComponent,
    ThemedItemPageTitleFieldComponent,
  ],
})
export class OrgUnitComponent extends BaseComponent {
}
