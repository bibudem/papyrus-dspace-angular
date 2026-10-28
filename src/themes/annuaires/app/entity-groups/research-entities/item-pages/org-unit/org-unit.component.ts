import {
  AsyncPipe,
  NgIf,
} from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { Context } from '../../../../../../../app/core/shared/context.model';
import { ViewMode } from '../../../../../../../app/core/shared/view-mode.model';
import { OrgUnitComponent as BaseComponent } from '../../../../../../../app/entity-groups/research-entities/item-pages/org-unit/org-unit.component';
import { GenericItemPageFieldComponent } from '../../../../../../../app/item-page/simple/field-components/specific-field/generic/generic-item-page-field.component';
import { ItemPageImgFieldComponent } from '../../../../../../../app/item-page/simple/field-components/specific-field/img/item-page-img-field.component';
import { ThemedItemPageTitleFieldComponent } from '../../../../../../../app/item-page/simple/field-components/specific-field/title/themed-item-page-field.component';
import { TabbedRelatedEntitiesSearchComponent } from '../../../../../../../app/item-page/simple/related-entities/tabbed-related-entities-search/tabbed-related-entities-search.component';
import { RelatedItemsComponent } from '../../../../../../../app/item-page/simple/related-items/related-items-component';
import { DsoEditMenuComponent } from '../../../../../../../app/shared/dso-page/dso-edit-menu/dso-edit-menu.component';
import { listableObjectComponent } from '../../../../../../../app/shared/object-collection/shared/listable-object/listable-object.decorator';

/** Durée d'affichage de la coche de confirmation après la copie du site web. */
const COPIED_FEEDBACK_DURATION_MS = 1500;

/**
 * Fiche OrgUnit : comme le thème montreal, sans vignette ni bouton « Retour aux résultats »
 * (déjà dans le fil d'Ariane du thème), avec le site web en ligne + bouton copier.
 * Le site web n'utilise pas ds-item-page-uri-field, partagé avec d'autres fiches (ex. Person).
 */
@listableObjectComponent('OrgUnit', ViewMode.StandalonePage, Context.Any, 'annuaires')
@Component({
  selector: 'ds-org-unit',
  styleUrls: ['./org-unit.component.scss'],
  templateUrl: './org-unit.component.html',
  standalone: true,
  imports: [
    AsyncPipe,
    DsoEditMenuComponent,
    GenericItemPageFieldComponent,
    ItemPageImgFieldComponent,
    NgIf,
    RelatedItemsComponent,
    RouterLink,
    TabbedRelatedEntitiesSearchComponent,
    ThemedItemPageTitleFieldComponent,
    TranslateModule,
  ],
})
export class OrgUnitComponent extends BaseComponent {

  /** Vrai brièvement après la copie (coche à la place de l'icône). */
  websiteUrlCopied = false;

  get websiteUrl(): string | null {
    return this.object?.firstMetadataValue('organization.url') ?? null;
  }

  /**
   * execCommand('copy') plutôt que navigator.clipboard : synchrone, donc la confirmation
   * s'affiche dès le premier clic (l'API asynchrone ne se résolvait parfois qu'au clic suivant).
   */
  copyWebsiteUrl(): void {
    const url = this.websiteUrl;
    if (!url) {
      return;
    }

    const textarea = document.createElement('textarea');
    textarea.value = url;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const succeeded = document.execCommand('copy');
    document.body.removeChild(textarea);

    if (succeeded) {
      this.websiteUrlCopied = true;
      setTimeout(() => { this.websiteUrlCopied = false; }, COPIED_FEEDBACK_DURATION_MS);
    }
  }
}
