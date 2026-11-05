import {
  AsyncPipe,
  NgTemplateOutlet,
} from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DoCheck,
  HostBinding,
  inject,
  OnInit,
} from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

import { DSpaceObjectDataService } from '../../../../../app/core/data/dspace-object-data.service';
import { ViewMode } from '../../../../../app/core/shared/view-mode.model';
import { pushInOut } from '../../../../../app/shared/animations/push';
import { SearchComponent as BaseComponent } from '../../../../../app/shared/search/search.component';
import { SearchLabelsComponent } from '../../../../../app/shared/search/search-labels/search-labels.component';
import { ThemedSearchResultsComponent } from '../../../../../app/shared/search/search-results/themed-search-results.component';
import { ThemedSearchSidebarComponent } from '../../../../../app/shared/search/search-sidebar/themed-search-sidebar.component';
import { ThemedSearchFormComponent } from '../../../../../app/shared/search-form/themed-search-form.component';
import { PageWithSidebarComponent } from '../../../../../app/shared/sidebar/page-with-sidebar.component';
import { ViewModeSwitchComponent } from '../../../../../app/shared/view-mode-switch/view-mode-switch.component';
import { isOrgUnitCollection } from '../org-unit-collection';

export const ANNUAIRES_SEARCH_PLACEHOLDER = 'papyrus.annuaires.search-form.placeholder';

/**
 * Recherche du répertoire : placeholder propre au répertoire plutôt que « Rechercher dans Papyrus ».
 * Collection « Unités académiques » : liste simple, sans filtres ni choix liste / grille.
 */
@Component({
  selector: 'ds-themed-search',
  styleUrls: ['../../../../../app/shared/search/search.component.scss'],
  templateUrl: '../../../../../app/shared/search/search.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [pushInOut],
  imports: [
    AsyncPipe,
    NgTemplateOutlet,
    PageWithSidebarComponent,
    SearchLabelsComponent,
    ThemedSearchFormComponent,
    ThemedSearchResultsComponent,
    ThemedSearchSidebarComponent,
    TranslateModule,
    ViewModeSwitchComponent,
  ],
})
export class SearchComponent extends BaseComponent implements OnInit, DoCheck {

  /** Masque les filtres (cf. _annuaires-style.scss) : décidé ici, où la portée est connue dès l'initialisation. */
  @HostBinding('class.annuaires-simple-list') simpleList = false;

  private readonly dsoService = inject(DSpaceObjectDataService);
  private readonly cdr = inject(ChangeDetectorRef);

  private checkedScope: string;

  ngOnInit(): void {
    // ThemedComponent recopie aussi les entrées non définies, ce qui efface la valeur par défaut.
    // Un placeholder explicite passé par le parent est conservé.
    if (!this.searchFormPlaceholder || this.searchFormPlaceholder === 'search.search-form.placeholder') {
      this.searchFormPlaceholder = ANNUAIRES_SEARCH_PLACEHOLDER;
    }
    super.ngOnInit();
  }

  /**
   * La portée peut arriver après ngOnInit : ThemedComponent assigne les entrées directement, sans ngOnChanges.
   * On ne vérifie la collection que lorsque la portée change.
   */
  ngDoCheck(): void {
    if (this.scope === this.checkedScope) {
      return;
    }
    this.checkedScope = this.scope;
    this.subs.push(isOrgUnitCollection(this.dsoService, this.scope).subscribe((isOrgUnits) => {
      if (isOrgUnits) {
        this.simpleList = true;
        this.showViewModes = false;
        this.viewModeList = [ViewMode.ListElement];
        this.cdr.markForCheck();
      }
    }));
  }
}
