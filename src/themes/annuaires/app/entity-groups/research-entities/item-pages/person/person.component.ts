import {
  AsyncPipe,
  NgIf,
} from '@angular/common';
import {
  AfterViewChecked,
  Component,
  ElementRef,
  inject,
} from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

import { DSONameService } from '../../../../../../../app/core/breadcrumbs/dso-name.service';
import { Context } from '../../../../../../../app/core/shared/context.model';
import { ViewMode } from '../../../../../../../app/core/shared/view-mode.model';
import { PersonComponent as BaseComponent } from '../../../../../../../app/entity-groups/research-entities/item-pages/person/person.component';
import { GenericItemPageFieldComponent } from '../../../../../../../app/item-page/simple/field-components/specific-field/generic/generic-item-page-field.component';
import { ItemPageUriFieldComponent } from '../../../../../../../app/item-page/simple/field-components/specific-field/uri/item-page-uri-field.component';
import { RelatedItemsComponent } from '../../../../../../../app/item-page/simple/related-items/related-items-component';
import { DsoEditMenuComponent } from '../../../../../../../app/shared/dso-page/dso-edit-menu/dso-edit-menu.component';
import { MetadataFieldWrapperComponent } from '../../../../../../../app/shared/metadata-field-wrapper/metadata-field-wrapper.component';
import { listableObjectComponent } from '../../../../../../../app/shared/object-collection/shared/listable-object/listable-object.decorator';
import { ThemedThumbnailComponent } from '../../../../../../../app/thumbnail/themed-thumbnail.component';
import { getOrcidId } from '../../../../orcid-members/orcid-id';
import { OrcidPersonEnrichmentComponent } from '../../../../orcid-members/orcid-person-enrichment/orcid-person-enrichment.component';

type ProfileSection = 'papyrus' | 'orcid';

/**
 * Fiche Person en 2 onglets : « Profil ORCID » (enrichissement) et « Papyrus » (relations DSpace),
 * pour séparer les données du dépôt de celles importées d'ORCID.
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
    AsyncPipe,
    DsoEditMenuComponent,
    GenericItemPageFieldComponent,
    ItemPageUriFieldComponent,
    MetadataFieldWrapperComponent,
    NgIf,
    OrcidPersonEnrichmentComponent,
    RelatedItemsComponent,
    ThemedThumbnailComponent,
    TranslateModule,
  ],
})
export class PersonComponent extends BaseComponent implements AfterViewChecked {

  activeSection: ProfileSection = 'orcid';

  private readonly elementRef: ElementRef<HTMLElement> = inject(ElementRef);

  private readonly dsoNameService = inject(DSONameService);

  /** « Prénom Nom » ; à défaut, le nom DSpace habituel (« Nom, Prénom »). */
  get displayName(): string {
    const givenName = this.object?.firstMetadataValue('person.givenName');
    const familyName = this.object?.firstMetadataValue('person.familyName');
    if (givenName && familyName) {
      return `${givenName} ${familyName}`;
    }
    return this.dsoNameService.getName(this.object);
  }

  get orcidId(): string | null {
    return getOrcidId(this.object);
  }

  get emails(): string[] {
    return this.object?.allMetadataValues('person.email') ?? [];
  }

  get expertises(): string[] {
    return this.object?.allMetadataValues('dc.subject.discipline') ?? [];
  }

  /**
   * Message « aucune publication » si tous les ds-related-items de l'onglet Papyrus sont masqués
   * (d-none) : lecture du DOM car RelationshipDataService ne se résolvait pas à temps (SSR/client).
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

  setSection(section: ProfileSection): void {
    this.activeSection = section;
  }
}
