import {
  AsyncPipe,
  NgIf,
} from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
} from '@angular/core';
import {
  RouterModule,
  RouterOutlet,
} from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { CommunityPageComponent as BaseComponent } from '../../../../app/community-page/community-page.component';
import { ThemedCollectionPageSubCollectionListComponent } from '../../../../app/community-page/sections/sub-com-col-section/sub-collection-list/themed-community-page-sub-collection-list.component';
import { ThemedCommunityPageSubCommunityListComponent } from '../../../../app/community-page/sections/sub-com-col-section/sub-community-list/themed-community-page-sub-community-list.component';
import { fadeInOut } from '../../../../app/shared/animations/fade';
import { ThemedComcolPageBrowseByComponent } from '../../../../app/shared/comcol/comcol-page-browse-by/themed-comcol-page-browse-by.component';
import { ThemedComcolPageContentComponent } from '../../../../app/shared/comcol/comcol-page-content/themed-comcol-page-content.component';
import { ThemedComcolPageHandleComponent } from '../../../../app/shared/comcol/comcol-page-handle/themed-comcol-page-handle.component';
import { ComcolPageHeaderComponent } from '../../../../app/shared/comcol/comcol-page-header/comcol-page-header.component';
import { ComcolPageLogoComponent } from '../../../../app/shared/comcol/comcol-page-logo/comcol-page-logo.component';
import { DsoEditMenuComponent } from '../../../../app/shared/dso-page/dso-edit-menu/dso-edit-menu.component';
import { ErrorComponent } from '../../../../app/shared/error/error.component';
import { ThemedLoadingComponent } from '../../../../app/shared/loading/themed-loading.component';
import { VarDirective } from '../../../../app/shared/utils/var.directive';

/**
 * Page communauté de l'annuaire des chercheurs UdeM (cf. config/config.papyrus.yml).
 * Réutilise le template de base tel quel — la personnalisation visuelle « annuaire » vient
 * des cartes de résultat (../entity-groups/research-entities/…), qui s'appliquent ici comme
 * dans les 2 sous-collections (héritage du thème par UUID).
 */
@Component({
  selector: 'ds-themed-community-page',
  templateUrl: '../../../../app/community-page/community-page.component.html',
  styleUrls: ['../../../../app/community-page/community-page.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [fadeInOut],
  standalone: true,
  imports: [
    ThemedComcolPageContentComponent,
    ErrorComponent,
    ThemedLoadingComponent,
    NgIf,
    TranslateModule,
    ThemedCommunityPageSubCommunityListComponent,
    ThemedCollectionPageSubCollectionListComponent,
    ThemedComcolPageBrowseByComponent,
    DsoEditMenuComponent,
    ThemedComcolPageHandleComponent,
    ComcolPageLogoComponent,
    ComcolPageHeaderComponent,
    AsyncPipe,
    VarDirective,
    RouterOutlet,
    RouterModule,
  ],
})
export class CommunityPageComponent extends BaseComponent {
}
