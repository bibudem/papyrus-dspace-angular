import {
  Component,
  ElementRef,
  inject,
  ViewChild,
} from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
} from '@angular/forms';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { SearchService } from '../../../../../app/core/shared/search/search.service';
import { ClickOutsideDirective } from '../../../../../app/shared/utils/click-outside.directive';
import {
  APP_CONFIG,
  AppConfig,
} from '../../../../../config/app-config.interface';
import { UUIDThemeConfig } from '../../../../../config/theme.config';

/** Thème dont l'UUID (config.*.yml) est celui de la communauté du répertoire. */
const DIRECTORY_THEME = 'annuaires';

/**
 * Loupe du répertoire, sur le modèle de la recherche de l'en-tête DSpace (ds-search-navbar) :
 * le champ s'ouvre au clic (transition CSS) et la recherche est limitée à la communauté du répertoire.
 */
@Component({
  selector: 'ds-annuaires-directory-search',
  templateUrl: './directory-search.component.html',
  styleUrls: ['./directory-search.component.scss'],
  imports: [
    ClickOutsideDirective,
    ReactiveFormsModule,
    TranslateModule,
  ],
})
export class DirectorySearchComponent {

  @ViewChild('searchInput') searchInput: ElementRef<HTMLInputElement>;

  readonly searchForm = new FormGroup({
    query: new FormControl('', { nonNullable: true }),
  });

  expanded = false;

  private readonly appConfig: AppConfig = inject(APP_CONFIG);
  private readonly router = inject(Router);
  private readonly searchService = inject(SearchService);

  /** Premier clic : ouvre le champ ; ensuite : lance la recherche. */
  onButtonClick(): void {
    if (this.expanded) {
      this.submit();
    } else {
      this.expanded = true;
      this.searchInput.nativeElement.focus();
    }
  }

  collapse(): void {
    this.expanded = false;
  }

  submit(): void {
    const query = this.searchForm.value.query?.trim();
    this.collapse();
    this.searchForm.reset();
    void this.router.navigate([this.searchService.getSearchLink()], {
      queryParams: {
        query: query || undefined,
        scope: this.directoryScope(),
      },
    });
  }

  private directoryScope(): string | undefined {
    const theme = this.appConfig.themes?.find(({ name }) => name === DIRECTORY_THEME) as UUIDThemeConfig | undefined;
    return theme?.uuid;
  }
}
