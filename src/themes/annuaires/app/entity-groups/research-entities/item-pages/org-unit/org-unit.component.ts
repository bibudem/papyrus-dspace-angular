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
import { TabbedRelatedEntitiesSearchComponent } from '../../../../../../../app/item-page/simple/related-entities/tabbed-related-entities-search/tabbed-related-entities-search.component';
import { RelatedItemsComponent } from '../../../../../../../app/item-page/simple/related-items/related-items-component';
import { listableObjectComponent } from '../../../../../../../app/shared/object-collection/shared/listable-object/listable-object.decorator';
import { DsoEditMenuComponent } from '../../../../../../../app/shared/dso-page/dso-edit-menu/dso-edit-menu.component';

/** Délai d'affichage de l'icône de confirmation après la copie du site web. */
const COPIED_FEEDBACK_DURATION_MS = 1500;

/**
 * Fiche OrgUnit de l'annuaire UdeM : identique à celle du thème montreal (date de fondation,
 * ville, pays, ROR, site web, liste des professeur-es de l'unité), sans la vignette (icône
 * générique peu utile pour une unité académique) ni le bouton "Retour aux résultats" — déjà
 * intégré au fil d'Ariane de ce thème (voir ../../../breadcrumbs/breadcrumbs.component.ts).
 *
 * Le champ "site web" n'utilise pas ds-item-page-uri-field (cœur) : affichage personnalisé en
 * ligne (lien + bouton copier) plutôt que le label au-dessus de la valeur par défaut — et ce
 * composant cœur est aussi réutilisé ailleurs (ex. URI sur la fiche Person), donc le surcharger
 * directement aurait affecté ces autres usages.
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
    RelatedItemsComponent,
    TabbedRelatedEntitiesSearchComponent,
    ThemedItemPageTitleFieldComponent,
  ],
})
export class OrgUnitComponent extends BaseComponent {

  /** URL du site web de l'unité (premier identifiant trouvé), ou null si absente. */
  get websiteUrl(): string | null {
    return this.object?.firstMetadataValue('organization.url') ?? null;
  }

  /** Vrai brièvement après un clic sur "copier" (affiche une coche à la place de l'icône). */
  websiteUrlCopied = false;

  /**
   * document.execCommand('copy') plutôt que navigator.clipboard.writeText() : cette dernière
   * passe par un flux de permission asynchrone qui peut rester en attente et ne se résoudre
   * qu'au clic suivant (icône de confirmation visible seulement au 2e clic). execCommand est
   * synchrone et directement lié au geste de clic, donc fiable dès le premier essai.
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
