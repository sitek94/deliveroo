import {computed, inject} from '@angular/core'
import {
  patchState,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withState,
} from '@ngrx/signals'
import {rxMethod} from '@ngrx/signals/rxjs-interop'
import {pipe, switchMap, tap} from 'rxjs'
import {tapResponse} from '@ngrx/operators'
import {DashboardHttpService} from './dashboard-http.service'
import {MetricDTO} from './dashboard.model'

interface DashboardState {
  metrics: MetricDTO[]
  loading: boolean
  error: string | null
}

const initialState: DashboardState = {
  metrics: [],
  loading: false,
  error: null,
}

export const DashboardStore = signalStore(
  withState(initialState),
  withComputed(({metrics}) => ({
    metricsCount: computed(() => metrics().length),
    hasMetrics: computed(() => metrics().length > 0),
  })),
  withMethods(store => {
    const dashboardHttpService = inject(DashboardHttpService)
    return {
      loadMetrics: rxMethod<void>(
        pipe(
          tap(() => patchState(store, {loading: true, error: null})),
          switchMap(() =>
            dashboardHttpService.getMetrics().pipe(
              tapResponse({
                next: metrics => patchState(store, {metrics, loading: false}),
                error: (error: any) =>
                  patchState(store, {
                    error: error?.message || 'Failed to load metrics',
                    loading: false,
                  }),
              }),
            ),
          ),
        ),
      ),
      resetError: () => patchState(store, {error: null}),
      clearMetrics: () => patchState(store, {metrics: []}),
    }
  }),
  withHooks({
    onInit(store) {
      store.loadMetrics()
    },
  }),
)
