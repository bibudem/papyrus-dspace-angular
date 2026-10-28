import { AsyncPipe } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { Context } from '../../../../../../../../app/core/shared/context.model';
import { ViewMode } from '../../../../../../../../app/core/shared/view-mode.model';
import { PersonSearchResultGridElementComponent as BaseComponent } from '../../../../../../../../app/entity-groups/research-entities/item-grid-elements/search-result-grid-elements/person/person-search-result-grid-element.component';
import { focusShadow } from '../../../../../../../../app/shared/animations/focus';
import { listableObjectComponent } from '../../../../../../../../app/shared/object-collection/shared/listable-object/listable-object.decorator';
import { TruncatableComponent } from '../../../../../../../../app/shared/truncatable/truncatable.component';
import { TruncatablePartComponent } from '../../../../../../../../app/shared/truncatable/truncatable-part/truncatable-part.component';
import { ThemedThumbnailComponent } from '../../../../../../../../app/thumbnail/themed-thumbnail.component';

/**
 * Carte « chercheur·euse » (vue grille) : image de remplacement au lieu du texte « pas de vignette »
 * et cadre .annuaires-grid-card (styles/_annuaires-style.scss).
 */
@listableObjectComponent('PersonSearchResult', ViewMode.GridElement, Context.Any, 'annuaires')
@Component({
  selector: 'ds-person-search-result-grid-element',
  styleUrls: ['../../../../../../../../app/entity-groups/research-entities/item-grid-elements/search-result-grid-elements/person/person-search-result-grid-element.component.scss'],
  templateUrl: './person-search-result-grid-element.component.html',
  standalone: true,
  animations: [focusShadow],
  imports: [
    AsyncPipe,
    RouterLink,
    ThemedThumbnailComponent,
    TranslateModule,
    TruncatableComponent,
    TruncatablePartComponent,
  ],
})
export class PersonSearchResultGridElementComponent extends BaseComponent {
}
