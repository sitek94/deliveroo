import {Component, Input, input} from '@angular/core'
import {CommonModule} from '@angular/common'

@Component({
  selector: 'app-stat-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="card p-6 hover:shadow-md transition-shadow duration-300">
      <div class="flex justify-between">
        <div>
          <p class="text-neutral-500 text-sm">{{ title() }}</p>
          <p class="text-2xl font-bold mt-1">{{ value() }}</p>
          <p class="mt-2 text-sm" [class]="getTrendClass()">
            @if (trend() !== 'neutral') {
            <span class="inline-block align-middle">
              {{ trend() === 'up' ? '↑' : '↓' }}
            </span>
            }
            {{ change() }}
          </p>
        </div>
        <div
          class="bg-primary-100 text-primary-600 p-3 rounded-full h-12 w-12 flex items-center justify-center"
        >
          <span class="material-icons">{{ icon() }}</span>
        </div>
      </div>
    </div>
  `,
})
export class StatCardComponent {
  title = input.required<string>()
  value = input.required<string>()
  change = input.required<string>()
  icon = input.required<string>()
  trend = input.required<'up' | 'down' | 'neutral'>()
  isPositiveChange = input.required<boolean>()

  getTrendClass(): string {
    if (this.trend() === 'neutral') {
      return 'text-neutral-500'
    }
    return this.isPositiveChange() ? 'text-success-500' : 'text-error-500'
  }
}
