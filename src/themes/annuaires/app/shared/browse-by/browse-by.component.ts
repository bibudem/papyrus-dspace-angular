import { AsyncPipe } from '@angular/common';
import { Component } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

import {
  fadeIn,
  fadeInOut,
} from '../../../../../app/shared/animations/fade';
import { BrowseByComponent as BaseComponent } from '../../../../../app/shared/browse-by/browse-by.component';
import { ErrorComponent } from '../../../../../app/shared/error/error.component';
import { ThemedLoadingComponent } from '../../../../../app/shared/loading/themed-loading.component';
import { ObjectCollectionComponent } from '../../../../../app/shared/object-collection/object-collection.component';
import { ThemedResultsBackButtonComponent } from '../../../../../app/shared/results-back-button/themed-results-back-button.component';
import { StartsWithLoaderComponent } from '../../../../../app/shared/starts-with/starts-with-loader.component';
import { StartsWithType } from '../../../../../app/shared/starts-with/starts-with-type';
import { VarDirective } from '../../../../../app/shared/utils/var.directive';
import { AnnuairesStartsWithTextComponent } from '../starts-with/text/starts-with-text.component';

/**
 * Parcours du répertoire : même page que DSpace, avec le champ « commence par » du répertoire.
 */
@Component({
  selector: 'ds-themed-browse-by',
  styleUrls: ['../../../../../app/shared/browse-by/browse-by.component.scss'],
  templateUrl: './browse-by.component.html',
  animations: [
    fadeIn,
    fadeInOut,
  ],
  imports: [
    AnnuairesStartsWithTextComponent,
    AsyncPipe,
    ErrorComponent,
    ObjectCollectionComponent,
    StartsWithLoaderComponent,
    ThemedLoadingComponent,
    ThemedResultsBackButtonComponent,
    TranslateModule,
    VarDirective,
  ],
})
export class BrowseByComponent extends BaseComponent {
  readonly startsWithType = StartsWithType;
}
