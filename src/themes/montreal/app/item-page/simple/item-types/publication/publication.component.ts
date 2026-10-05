import {
  AsyncPipe,
  KeyValuePipe,
  NgFor,
  NgIf,
} from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { Context } from '../../../../../../../app/core/shared/context.model';
import { ViewMode } from '../../../../../../../app/core/shared/view-mode.model';
import { CollectionsComponent } from '../../../../../../../app/item-page/field-components/collections/collections.component';
import { ThemedMediaViewerComponent } from '../../../../../../../app/item-page/media-viewer/themed-media-viewer.component';
import { MiradorViewerComponent } from '../../../../../../../app/item-page/mirador-viewer/mirador-viewer.component';
import { ThemedFileSectionComponent } from '../../../../../../../app/item-page/simple/field-components/file-section/themed-file-section.component';
import { ItemPageAbstractFieldComponent } from '../../../../../../../app/item-page/simple/field-components/specific-field/abstract/item-page-abstract-field.component';
import { ItemPageCcLicenseFieldComponent } from '../../../../../../../app/item-page/simple/field-components/specific-field/cc-license/item-page-cc-license-field.component';
import { GenericItemPageFieldComponent } from '../../../../../../../app/item-page/simple/field-components/specific-field/generic/generic-item-page-field.component';
import { ItemPageOrcidFieldComponent } from '../../../../../../../app/item-page/simple/field-components/specific-field/orcid/item-page-orcid-field.component';
import { ThemedItemPageTitleFieldComponent } from '../../../../../../../app/item-page/simple/field-components/specific-field/title/themed-item-page-field.component';
import { ItemPageUriFieldComponent } from '../../../../../../../app/item-page/simple/field-components/specific-field/uri/item-page-uri-field.component';
import { PublicationComponent as BaseComponent } from '../../../../../../../app/item-page/simple/item-types/publication/publication.component';
import { ThemedMetadataRepresentationListComponent } from '../../../../../../../app/item-page/simple/metadata-representation-list/themed-metadata-representation-list.component';
import { RelatedItemsComponent } from '../../../../../../../app/item-page/simple/related-items/related-items-component';
import { listableObjectComponent } from '../../../../../../../app/shared/object-collection/shared/listable-object/listable-object.decorator';
import { DsoEditMenuComponent } from '../../../../../../../app/shared/dso-page/dso-edit-menu/dso-edit-menu.component';
import { MetadataFieldWrapperComponent } from '../../../../../../../app/shared/metadata-field-wrapper/metadata-field-wrapper.component';
import { ThemedResultsBackButtonComponent } from '../../../../../../../app/shared/results-back-button/themed-results-back-button.component';
import { ThemedThumbnailComponent } from '../../../../../../../app/thumbnail/themed-thumbnail.component';

/**
 * Fiche Publication (thème montreal, site-wide) : ajoute le champ URI (DOI, hasVersion,
 * relation, endorsement, review...) et l'affichage ORCID des auteurs/autrices, absents de la
 * fiche Publication de base. S'applique à toutes les publications du site, y compris celles
 * liées depuis l'annuaire des chercheurs (hors de la communauté « Corps professoral »,
 * donc non couvertes par le thème "annuaires").
 */
@listableObjectComponent('Publication', ViewMode.StandalonePage, Context.Any, 'montreal')
@Component({
  selector: 'ds-publication',
  styleUrls: ['./publication.component.scss'],
  templateUrl: './publication.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    NgIf,
    NgFor,
    ThemedResultsBackButtonComponent,
    MiradorViewerComponent,
    ThemedItemPageTitleFieldComponent,
    DsoEditMenuComponent,
    MetadataFieldWrapperComponent,
    ThemedThumbnailComponent,
    ThemedMediaViewerComponent,
    ThemedFileSectionComponent,
    ThemedMetadataRepresentationListComponent,
    GenericItemPageFieldComponent,
    RelatedItemsComponent,
    ItemPageAbstractFieldComponent,
    ItemPageUriFieldComponent,
    CollectionsComponent,
    RouterLink,
    AsyncPipe,
    TranslateModule,
    ItemPageCcLicenseFieldComponent,
    KeyValuePipe,
    ItemPageOrcidFieldComponent,
  ],
})
export class PublicationComponent extends BaseComponent {
}
