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
import { MetadataFieldWrapperComponent } from '../../../../../../../app/shared/metadata-field-wrapper/metadata-field-wrapper.component';
import { ThemedResultsBackButtonComponent } from '../../../../../../../app/shared/results-back-button/themed-results-back-button.component';
import { ThemedThumbnailComponent } from '../../../../../../../app/thumbnail/themed-thumbnail.component';

/**
 * Fiche OrgUnit (thème montreal, site-wide) : date de fondation, ville, pays,
 * identifiant ROR, site web, et liste des professeur-es de l'unité (isOrgUnitOfPerson).
 */
@listableObjectComponent('OrgUnit', ViewMode.StandalonePage, Context.Any, 'montreal')
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
    MetadataFieldWrapperComponent,
    RelatedItemsComponent,
    TabbedRelatedEntitiesSearchComponent,
    ThemedItemPageTitleFieldComponent,
    ThemedResultsBackButtonComponent,
    ThemedThumbnailComponent,
  ],
})
export class OrgUnitComponent extends BaseComponent {
}
