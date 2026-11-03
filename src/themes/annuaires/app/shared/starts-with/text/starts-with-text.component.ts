import { Component } from '@angular/core';
import {
  FormsModule,
  ReactiveFormsModule,
} from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { StartsWithTextComponent as BaseComponent } from '../../../../../../app/shared/starts-with/text/starts-with-text.component';

/**
 * Champ « commence par » des pages de parcours du répertoire : seul le placeholder change.
 * Le composant DSpace n'est pas thématisable, d'où son remplacement dans browse-by.
 */
@Component({
  selector: 'ds-annuaires-starts-with-text',
  styleUrls: ['../../../../../../app/shared/starts-with/text/starts-with-text.component.scss'],
  templateUrl: './starts-with-text.component.html',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    TranslateModule,
  ],
})
export class AnnuairesStartsWithTextComponent extends BaseComponent {
}
