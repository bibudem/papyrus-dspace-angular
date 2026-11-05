import { SlicePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  Input,
  OnChanges,
} from '@angular/core';
import {
  TranslateModule,
  TranslateService,
} from '@ngx-translate/core';

import { PersonFundings } from './person-fundings.service';

/**
 * Liste des financements d'une personne (Synchro Recherche)
 */
@Component({
  selector: 'ds-person-fundings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './person-fundings.component.html',
  styleUrls: ['./person-fundings.component.scss'],
  imports: [
    SlicePipe,
    TranslateModule,
  ],
})
export class PersonFundingsComponent implements OnChanges {

  @Input({ required: true }) data: PersonFundings;

  readonly previewCount = 10;

  showAll = false;

  updatedOn: string | null = null;

  private readonly translate = inject(TranslateService);

  ngOnChanges(): void {
    this.updatedOn = this.formatDate(this.data?.updatedAt);
  }

  toggleShowAll(): void {
    this.showAll = !this.showAll;
  }

  private formatDate(value: string | null | undefined): string | null {
    const date = value ? new Date(value) : null;
    if (!date || isNaN(date.getTime())) {
      return null;
    }
    const lang = this.translate.getCurrentLang() || this.translate.getFallbackLang() || 'fr';
    return new Intl.DateTimeFormat(lang, { dateStyle: 'long' }).format(date);
  }
}
