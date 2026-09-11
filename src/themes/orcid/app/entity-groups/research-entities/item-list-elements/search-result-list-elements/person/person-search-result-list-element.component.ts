import {
  AsyncPipe,
  NgClass,
  NgFor,
  NgIf,
} from '@angular/common';
import {
  Component,
  Inject,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { APP_CONFIG, AppConfig } from '../../../../../../../../config/app-config.interface';
import { DSONameService } from '../../../../../../../../app/core/breadcrumbs/dso-name.service';
import { Context } from '../../../../../../../../app/core/shared/context.model';
import { ViewMode } from '../../../../../../../../app/core/shared/view-mode.model';
import { ThemedBadgesComponent } from '../../../../../../../../app/shared/object-collection/shared/badges/themed-badges.component';
import { listableObjectComponent } from '../../../../../../../../app/shared/object-collection/shared/listable-object/listable-object.decorator';
import { PersonSearchResultListElementComponent as BaseComponent } from '../../../../../../../../app/entity-groups/research-entities/item-list-elements/search-result-list-elements/person/person-search-result-list-element.component';
import { TruncatableComponent } from '../../../../../../../../app/shared/truncatable/truncatable.component';
import { TruncatableService } from '../../../../../../../../app/shared/truncatable/truncatable.service';
import { TruncatablePartComponent } from '../../../../../../../../app/shared/truncatable/truncatable-part/truncatable-part.component';
import { ThemedThumbnailComponent } from '../../../../../../../../app/thumbnail/themed-thumbnail.component';

/** Carte "chercheur·euse" (vue liste) pour l'annuaire UdeM. */
@listableObjectComponent('PersonSearchResult', ViewMode.ListElement, Context.Any, 'orcid')
@Component({
  selector: 'ds-person-search-result-list-element',
  styleUrls: ['./person-search-result-list-element.component.scss'],
  templateUrl: './person-search-result-list-element.component.html',
  standalone: true,
  imports: [NgIf, RouterLink, ThemedThumbnailComponent, NgClass, ThemedBadgesComponent, TruncatableComponent, TruncatablePartComponent, NgFor, AsyncPipe, TranslateModule],
})
export class PersonSearchResultListElementComponent extends BaseComponent {

  /** Clés de métadonnées DSpace connues pour l'ORCID iD (mêmes clés que le panneau d'enrichissement). */
  private static readonly ORCID_METADATA_KEYS = ['dspace.author.orcid', 'person.identifier.orcid'] as const;

  public constructor(
    protected truncatableService: TruncatableService,
    public dsoNameService: DSONameService,
    @Inject(APP_CONFIG) protected appConfig: AppConfig,
  ) {
    super(truncatableService, dsoNameService, appConfig);
  }

  /** Vrai si un ORCID iD est renseigné sur cet item — affiche le badge ORCID sur la carte. */
  get hasOrcid(): boolean {
    return !!this.orcidUrl;
  }

  /** URL complète du profil ORCID (https://orcid.org/0000-...), ou null si absent. */
  get orcidUrl(): string | null {
    for (const key of PersonSearchResultListElementComponent.ORCID_METADATA_KEYS) {
      const raw = this.dso?.firstMetadataValue(key);
      if (raw) {
        const id = raw.replace(/^(https?:\/\/)?orcid\.org\//, '').trim();
        return id ? `https://orcid.org/${id}` : null;
      }
    }
    return null;
  }
}
