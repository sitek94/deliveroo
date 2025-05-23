import {Component, inject} from '@angular/core'
import {CommonModule} from '@angular/common'
import {StatCardComponent} from './components/stat-card.component'
import {DashboardStore} from './dashboard-store.service'

@Component({
  selector: 'app-metrics',
  standalone: true,
  imports: [CommonModule, StatCardComponent],
  template: `
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      @if (store.loading()) {
      <div class="col-span-full">
        <p class="text-gray-500">Loading metrics...</p>
      </div>
      } @else if (store.error()) {
      <div class="col-span-full">
        <p class="text-red-500">Error: {{ store.error() }}</p>
      </div>
      } @else { @for (metric of store.metrics(); track metric.title) {
      <app-stat-card
        [title]="metric.title"
        [value]="metric.value"
        [change]="metric.change"
        [icon]="metric.icon"
        [trend]="metric.trend"
        [isPositiveChange]="metric.isPositiveChange"
      >
      </app-stat-card>
      } @empty {
      <p class="text-gray-500">No metrics available</p>
      } }
    </div>
  `,
  styles: ``,
})
export class MetricsComponent {
  store = inject(DashboardStore)
}
