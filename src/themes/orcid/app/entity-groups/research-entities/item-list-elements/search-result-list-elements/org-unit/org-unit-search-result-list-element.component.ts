import {
  AsyncPipe,
  NgClass,
  NgIf,
} from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { Context } from '../../../../../../../../app/core/shared/context.model';
import { ViewMode } from '../../../../../../../../app/core/shared/view-mode.model';
import { ThemedBadgesComponent } from '../../../../../../../../app/shared/object-collection/shared/badges/themed-badges.component';
import { listableObjectComponent } from '../../../../../../../../app/shared/object-collection/shared/listable-object/listable-object.decorator';
import { OrgUnitSearchResultListElementComponent as BaseComponent } from '../../../../../../../../app/entity-groups/research-entities/item-list-elements/search-result-list-elements/org-unit/org-unit-search-result-list-element.component';
import { TruncatableComponent } from '../../../../../../../../app/shared/truncatable/truncatable.component';
import { TruncatablePartComponent } from '../../../../../../../../app/shared/truncatable/truncatable-part/truncatable-part.component';
import { ThemedThumbnailComponent } from '../../../../../../../../app/thumbnail/themed-thumbnail.component';

/** Carte "unité académique" (vue liste) pour l'annuaire UdeM. */
@listableObjectComponent('OrgUnitSearchResult', ViewMode.ListElement, Context.Any, 'orcid')
@Component({
  selector: 'ds-org-unit-search-result-list-element',
  styleUrls: ['./org-unit-search-result-list-element.component.scss'],
  templateUrl: './org-unit-search-result-list-element.component.html',
  standalone: true,
  imports: [NgIf, RouterLink, ThemedThumbnailComponent, NgClass, ThemedBadgesComponent, TruncatableComponent, TruncatablePartComponent, AsyncPipe, TranslateModule],
})
export class OrgUnitSearchResultListElementComponent extends BaseComponent {
}
