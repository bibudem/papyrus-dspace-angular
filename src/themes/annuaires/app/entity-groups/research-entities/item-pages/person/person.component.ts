import { AsyncPipe, NgIf } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { catchError, map } from 'rxjs/operators';
import { of } from 'rxjs';

import { FindListOptions } from '../../../../../../../app/core/data/find-list-options.model';
import { RelationshipDataService } from '../../../../../../../app/core/data/relationship-data.service';
import { Context } from '../../../../../../../app/core/shared/context.model';
import { getFirstCompletedRemoteData } from '../../../../../../../app/core/shared/operators';
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
 * institutionnel de celles importées d'ORCID. L'onglet « Papyrus » n'est affiché que si la
 * personne a au moins une publication dans Papyrus (voir hasPublications$).
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
export class PersonComponent extends BaseComponent implements OnInit {
  private readonly relationshipService = inject(RelationshipDataService);

  /** Onglet actif — « ORCID » par défaut. */
  activeSection: ProfileSection = 'orcid';

  /**
   * Vrai tant qu'on ne sait pas encore si la personne a des publications (évite de masquer
   * l'onglet à tort pendant le chargement) ; mis à jour une fois la requête résolue.
   */
  hasPublications = true;

  setSection(section: ProfileSection): void {
    this.activeSection = section;
  }

  ngOnInit(): void {
    super.ngOnInit();

    this.relationshipService.getRelatedItemsByLabel(
      this.object,
      'isPublicationOfAuthor',
      Object.assign(new FindListOptions(), { elementsPerPage: 1, currentPage: 1 }),
    ).pipe(
      getFirstCompletedRemoteData(),
      map((rd) => rd.hasSucceeded && (rd.payload?.totalElements ?? 0) > 0),
      // En cas d'erreur réseau, ne pas masquer l'onglet à tort.
      catchError(() => of(true)),
    ).subscribe((hasPublications) => {
      this.hasPublications = hasPublications;
      if (!hasPublications && this.activeSection === 'papyrus') {
        this.activeSection = 'orcid';
      }
    });
  }
}
