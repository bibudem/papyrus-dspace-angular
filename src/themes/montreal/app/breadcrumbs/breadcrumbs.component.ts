import { Component } from '@angular/core';
import { BreadcrumbsComponent as BaseComponent } from '../../../../app/breadcrumbs/breadcrumbs.component';

/**
 * Component representing the breadcrumbs of a page
 */
@Component({
  selector: 'ds-breadcrumbs',
  templateUrl: 'breadcrumbs.component.html',
  styleUrls: ['breadcrumbs.component.scss']
})
export class BreadcrumbsComponent extends BaseComponent {
}
