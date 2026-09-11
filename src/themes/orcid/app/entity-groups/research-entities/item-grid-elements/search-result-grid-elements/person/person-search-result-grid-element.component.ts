import { AsyncPipe } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { Context } from '../../../../../../../../app/core/shared/context.model';
import { ViewMode } from '../../../../../../../../app/core/shared/view-mode.model';
import { focusShadow } from '../../../../../../../../app/shared/animations/focus';
import { ThemedBadgesComponent } from '../../../../../../../../app/shared/object-collection/shared/badges/themed-badges.component';
import { listableObjectComponent } from '../../../../../../../../app/shared/object-collection/shared/listable-object/listable-object.decorator';
import { PersonSearchResultGridElementComponent as BaseComponent } from '../../../../../../../../app/entity-groups/research-entities/item-grid-elements/search-result-grid-elements/person/person-search-result-grid-element.component';
import { TruncatableComponent } from '../../../../../../../../app/shared/truncatable/truncatable.component';
import { TruncatablePartComponent } from '../../../../../../../../app/shared/truncatable/truncatable-part/truncatable-part.component';
import { ThemedThumbnailComponent } from '../../../../../../../../app/thumbnail/themed-thumbnail.component';

/**
 * Carte "chercheur·euse" (vue grille) pour l'annuaire UdeM : image de remplacement au lieu
 * du texte "Pas de vignette d'image disponible", cadre plus ergonomique (voir
 * .directory-grid-card dans styles/_directory-styles.scss).
 */
@listableObjectComponent('PersonSearchResult', ViewMode.GridElement, Context.Any, 'orcid')
@Component({
  selector: 'ds-person-search-result-grid-element',
  styleUrls: ['../../../../../../../../app/entity-groups/research-entities/item-grid-elements/search-result-grid-elements/person/person-search-result-grid-element.component.scss'],
  templateUrl: './person-search-result-grid-element.component.html',
  standalone: true,
  animations: [focusShadow],
  imports: [
    AsyncPipe,
    RouterLink,
    ThemedBadgesComponent,
    ThemedThumbnailComponent,
    TranslateModule,
    TruncatableComponent,
    TruncatablePartComponent,
  ],
})
export class PersonSearchResultGridElementComponent extends BaseComponent {
}
