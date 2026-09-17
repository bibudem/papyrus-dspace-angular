import { AsyncPipe, NgIf } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { Context } from '../../../../../../../app/core/shared/context.model';
import { ViewMode } from '../../../../../../../app/core/shared/view-mode.model';
import { PersonComponent as BaseComponent } from '../../../../../../../app/entity-groups/research-entities/item-pages/person/person.component';
import { GenericItemPageFieldComponent } from '../../../../../../../app/item-page/simple/field-components/specific-field/generic/generic-item-page-field.component';
import { ItemPageOrcidFieldComponent } from '../../../../../../../app/item-page/simple/field-components/specific-field/orcid/item-page-orcid-field.component';
import { ThemedItemPageTitleFieldComponent } from '../../../../../../../app/item-page/simple/field-components/specific-field/title/themed-item-page-field.component';
import { ItemPageUriFieldComponent } from '../../../../../../../app/item-page/simple/field-components/specific-field/uri/item-page-uri-field.component';
import { RelatedItemsComponent } from '../../../../../../../app/item-page/simple/related-items/related-items-component';
import { listableObjectComponent } from '../../../../../../../app/shared/object-collection/shared/listable-object/listable-object.decorator';
import { DsoEditMenuComponent } from '../../../../../../../app/shared/dso-page/dso-edit-menu/dso-edit-menu.component';
import { MetadataFieldWrapperComponent } from '../../../../../../../app/shared/metadata-field-wrapper/metadata-field-wrapper.component';
import { ThemedResultsBackButtonComponent } from '../../../../../../../app/shared/results-back-button/themed-results-back-button.component';
import { ThemedThumbnailComponent } from '../../../../../../../app/thumbnail/themed-thumbnail.component';
import { OrcidPersonEnrichmentComponent } from '../../../../orcid-members/orcid-person-enrichment/orcid-person-enrichment.component';

type ProfileSection = 'papyrus' | 'orcid';

/**
 * Fiche Person de l'annuaire UdeM. Le contenu principal a 2 onglets : « Papyrus » (relations
 * DSpace) et « ORCID » (panneau d'enrichissement, voir ../../../orcid-members/) — pour
 * distinguer les données du dépôt institutionnel de celles importées d'ORCID.
 */
@listableObjectComponent('Person', ViewMode.StandalonePage, Context.Any, 'orcid')
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
    ThemedResultsBackButtonComponent,
    ThemedThumbnailComponent,
    // DSpace item-page
    GenericItemPageFieldComponent,
    ItemPageOrcidFieldComponent,
    ItemPageUriFieldComponent,
    RelatedItemsComponent,
    // Local
    OrcidPersonEnrichmentComponent,
  ],
})
export class PersonComponent extends BaseComponent {
  /** Onglet actif — « Papyrus » par défaut. */
  activeSection: ProfileSection = 'papyrus';

  setSection(section: ProfileSection): void {
    this.activeSection = section;
  }
}
