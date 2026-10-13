import { AsyncPipe, NgIf } from '@angular/common';
import { AfterViewChecked, Component, ElementRef, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { Context } from '../../../../../../../app/core/shared/context.model';
import { ViewMode } from '../../../../../../../app/core/shared/view-mode.model';
import { PersonComponent as BaseComponent } from '../../../../../../../app/entity-groups/research-entities/item-pages/person/person.component';
import { GenericItemPageFieldComponent } from '../../../../../../../app/item-page/simple/field-components/specific-field/generic/generic-item-page-field.component';
import { ThemedItemPageTitleFieldComponent } from '../../../../../../../app/item-page/simple/field-components/specific-field/title/themed-item-page-field.component';
import { ItemPageUriFieldComponent } from '../../../../../../../app/item-page/simple/field-components/specific-field/uri/item-page-uri-field.component';
import { RelatedItemsComponent } from '../../../../../../../app/item-page/simple/related-items/related-items-component';
import { listableObjectComponent } from '../../../../../../../app/shared/object-collection/shared/listable-object/listable-object.decorator';
import { DsoEditMenuComponent } from '../../../../../../../app/shared/dso-page/dso-edit-menu/dso-edit-menu.component';
import { MetadataFieldWrapperComponent } from '../../../../../../../app/shared/metadata-field-wrapper/metadata-field-wrapper.component';
import { ThemedThumbnailComponent } from '../../../../../../../app/thumbnail/themed-thumbnail.component';
import { OrcidPersonEnrichmentComponent } from '../../../../orcid-members/orcid-person-enrichment/orcid-person-enrichment.component';

type ProfileSection = 'papyrus' | 'orcid';

/**
 * Fiche Person de l'annuaire UdeM. Le contenu principal a 2 onglets : « Profil ORCID »
 * (panneau d'enrichissement, voir ../../../orcid-members/) et « Papyrus » (relations DSpace —
 * projets, publications, direction de recherche) — pour distinguer les données du dépôt
 * institutionnel de celles importées d'ORCID. L'onglet « Papyrus » reste toujours visible ; un
 * message "aucune publication" s'affiche à la place quand les 3 ds-related-items de cet onglet
 * sont vides.
 *
 * La détection du contenu vide s'appuie sur le DOM déjà rendu par ds-related-items (qui masque
 * son wrapper en `d-none` quand il est vide, voir metadata-field-wrapper.component.html) plutôt
 * que sur un appel RelationshipDataService séparé — ce dernier ne se résolvait jamais à temps
 * (SSR comme client). Même technique que search-filters.component.ts dans ce thème (relabelage
 * via ngAfterViewChecked + manipulation DOM directe).
 */
@listableObjectComponent('Person', ViewMode.StandalonePage, Context.Any, 'annuaires')
@Component({
  selector: 'ds-person',
  styleUrls: [
    '../../../../../../../app/entity-groups/research-entities/item-pages/person/person.component.scss',
  ],
  templateUrl: './person.component.html',
  standalone: true,
  imports: [
    // Angular
    AsyncPipe,
    NgIf,
    RouterLink,
    TranslateModule,
    // DSpace shared
    DsoEditMenuComponent,
    MetadataFieldWrapperComponent,
    ThemedItemPageTitleFieldComponent,
    ThemedThumbnailComponent,
    // DSpace item-page
    GenericItemPageFieldComponent,
    ItemPageUriFieldComponent,
    RelatedItemsComponent,
    // Local
    OrcidPersonEnrichmentComponent,
  ],
})
export class PersonComponent extends BaseComponent implements OnInit, AfterViewChecked {

  private readonly elementRef: ElementRef<HTMLElement> = inject(ElementRef);

  /** Onglet actif — « ORCID » par défaut. */
  activeSection: ProfileSection = 'orcid';

  setSection(section: ProfileSection): void {
    this.activeSection = section;
  }

  ngOnInit(): void {
    super.ngOnInit();
  }

  /**
   * Affiche le message "aucune publication" si et seulement si les 3 ds-related-items de
   * l'onglet Papyrus sont tous vides (wrapper `.simple-view-element` masqué en `d-none`).
   * Ne fait rien si l'onglet Papyrus n'est pas affiché (section absente du DOM).
   */
  ngAfterViewChecked(): void {
    const section = this.elementRef.nativeElement.querySelector<HTMLElement>('#profile-panel-papyrus');
    if (!section) {
      return;
    }
    const message = section.querySelector<HTMLElement>('.papyrus-empty-message');
    if (!message) {
      return;
    }
    const hasVisibleContent = section.querySelectorAll('.simple-view-element:not(.d-none)').length > 0;
    message.classList.toggle('d-none', hasVisibleContent);
  }
}
