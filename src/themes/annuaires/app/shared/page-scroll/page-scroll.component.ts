import { isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  HostListener,
  inject,
  OnInit,
  PLATFORM_ID,
} from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

import { ResultsScrollService } from './results-scroll.service';

const BACK_TO_TOP_THRESHOLD_PX = 600;

/**
 * Bouton « Haut de page » quand on est descendu assez bas. Démarre aussi le défilement vers
 * les résultats du répertoire (ResultsScrollService).
 */
@Component({
  selector: 'ds-annuaires-page-scroll',
  templateUrl: './page-scroll.component.html',
  styleUrls: ['./page-scroll.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslateModule,
  ],
})
export class PageScrollComponent implements OnInit {
  showBackToTop = false;

  private readonly cdr = inject(ChangeDetectorRef);
  private readonly resultsScroll = inject(ResultsScrollService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  ngOnInit(): void {
    this.resultsScroll.start();
  }

  @HostListener('window:scroll')
  onWindowScroll(): void {
    if (!this.isBrowser) {
      return;
    }
    const visible = window.scrollY > BACK_TO_TOP_THRESHOLD_PX;
    if (visible !== this.showBackToTop) {
      this.showBackToTop = visible;
      this.cdr.markForCheck();
    }
  }

  backToTop(): void {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' });
  }
}
