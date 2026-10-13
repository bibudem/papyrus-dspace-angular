import {
  AsyncPipe,
  NgClass,
  NgFor,
  NgIf,
} from '@angular/common';
import {
  Component,
  Inject,
  OnInit,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { APP_CONFIG, AppConfig } from '../../../../../../../../config/app-config.interface';
import { DSONameService } from '../../../../../../../../app/core/breadcrumbs/dso-name.service';
import { FindListOptions } from '../../../../../../../../app/core/data/find-list-options.model';
import { RelationshipDataService } from '../../../../../../../../app/core/data/relationship-data.service';
import { Context } from '../../../../../../../../app/core/shared/context.model';
import { getFirstCompletedRemoteData } from '../../../../../../../../app/core/shared/operators';
import { ViewMode } from '../../../../../../../../app/core/shared/view-mode.model';
import { listableObjectComponent } from '../../../../../../../../app/shared/object-collection/shared/listable-object/listable-object.decorator';
import { PersonSearchResultListElementComponent as BaseComponent } from '../../../../../../../../app/entity-groups/research-entities/item-list-elements/search-result-list-elements/person/person-search-result-list-element.component';
import { TruncatableComponent } from '../../../../../../../../app/shared/truncatable/truncatable.component';
import { TruncatableService } from '../../../../../../../../app/shared/truncatable/truncatable.service';
import { TruncatablePartComponent } from '../../../../../../../../app/shared/truncatable/truncatable-part/truncatable-part.component';
import { ThemedThumbnailComponent } from '../../../../../../../../app/thumbnail/themed-thumbnail.component';

/** Carte "chercheur·euse" (vue liste) pour l'annuaire UdeM. */
@listableObjectComponent('PersonSearchResult', ViewMode.ListElement, Context.Any, 'annuaires')
@Component({
  selector: 'ds-person-search-result-list-element',
  styleUrls: ['./person-search-result-list-element.component.scss'],
  templateUrl: './person-search-result-list-element.component.html',
  standalone: true,
  imports: [NgIf, RouterLink, ThemedThumbnailComponent, NgClass, TruncatableComponent, TruncatablePartComponent, NgFor, AsyncPipe, TranslateModule],
})
export class PersonSearchResultListElementComponent extends BaseComponent implements OnInit {

  /** Clés de métadonnées DSpace connues pour l'ORCID iD (mêmes clés que le panneau d'enrichissement). */
  private static readonly ORCID_METADATA_KEYS = ['dspace.author.orcid', 'person.identifier.orcid'] as const;

  /** Nom de l'unité d'affiliation (relation isOrgUnitOfPerson) affichée sur la carte, ou null si absente. */
  affiliationName$: Observable<string | null>;

  public constructor(
    protected truncatableService: TruncatableService,
    public dsoNameService: DSONameService,
    @Inject(APP_CONFIG) protected appConfig: AppConfig,
    private relationshipService: RelationshipDataService,
  ) {
    super(truncatableService, dsoNameService, appConfig);
  }

  ngOnInit(): void {
    super.ngOnInit();

    const options = Object.assign(new FindListOptions(), { elementsPerPage: 1, currentPage: 1 });
    this.affiliationName$ = this.relationshipService.getRelatedItemsByLabel(this.dso, 'isOrgUnitOfPerson', options).pipe(
      getFirstCompletedRemoteData(),
      map((rd) => {
        const orgUnit = rd.hasSucceeded ? rd.payload?.page?.[0] : undefined;
        return orgUnit ? this.dsoNameService.getName(orgUnit) : null;
      }),
      catchError(() => of(null)),
    );
  }

  /** Vrai si un ORCID iD est renseigné sur cet item — affiche le badge ORCID sur la carte. */
  get hasOrcid(): boolean {
    return !!this.orcidUrl;
  }

  /** ORCID iD normalisé (0000-0000-0000-0000), ou null si absent — n'est plus affiché en lien externe. */
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
