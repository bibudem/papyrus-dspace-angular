import {
  AsyncPipe,
  NgIf,
} from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { GenericItemPageFieldComponent } from 'src/app/item-page/simple/field-components/specific-field/generic/generic-item-page-field.component';
import { ItemPageImgFieldComponent } from 'src/app/item-page/simple/field-components/specific-field/img/item-page-img-field.component';
import { ThemedItemPageTitleFieldComponent } from 'src/app/item-page/simple/field-components/specific-field/title/themed-item-page-field.component';
import { ItemComponent } from 'src/app/item-page/simple/item-types/shared/item.component';
import { TabbedRelatedEntitiesSearchComponent } from 'src/app/item-page/simple/related-entities/tabbed-related-entities-search/tabbed-related-entities-search.component';
import { RelatedItemsComponent } from 'src/app/item-page/simple/related-items/related-items-component';
import { DsoEditMenuComponent } from 'src/app/shared/dso-page/dso-edit-menu/dso-edit-menu.component';
import { MetadataFieldWrapperComponent } from 'src/app/shared/metadata-field-wrapper/metadata-field-wrapper.component';
import { listableObjectComponent } from 'src/app/shared/object-collection/shared/listable-object/listable-object.decorator';
import { ThemedResultsBackButtonComponent } from 'src/app/shared/results-back-button/themed-results-back-button.component';
import { ThemedThumbnailComponent } from 'src/app/thumbnail/themed-thumbnail.component';
import { ItemPageUriFieldComponent } from 'src/app/item-page/simple/field-components/specific-field/uri/item-page-uri-field.component';

import { Context } from '../../../../../../../app/core/shared/context.model';
import { ViewMode } from '../../../../../../../app/core/shared/view-mode.model';

@listableObjectComponent('OrgUnit', ViewMode.StandalonePage, Context.Any, 'montreal')
@Component({
  selector: 'ds-org-unit',
  styleUrls: ['../../../../../../../app/entity-groups/research-entities/item-pages/org-unit/org-unit.component.scss'],
  templateUrl: './org-unit.component.html',
  standalone: true,
  imports: [NgIf, ThemedResultsBackButtonComponent, ThemedItemPageTitleFieldComponent, DsoEditMenuComponent, MetadataFieldWrapperComponent, ThemedThumbnailComponent, GenericItemPageFieldComponent, RelatedItemsComponent, RouterLink, TabbedRelatedEntitiesSearchComponent, AsyncPipe, TranslateModule, ItemPageImgFieldComponent, ItemPageUriFieldComponent],
})
/**
 * The component for displaying metadata and relations of an item of the type Organisation Unit
 */
export class OrgUnitComponent extends ItemComponent {
}
