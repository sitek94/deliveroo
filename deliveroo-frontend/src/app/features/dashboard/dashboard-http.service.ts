import {inject, Injectable} from '@angular/core'
import {Observable} from 'rxjs'
import {HttpClient} from '@angular/common/http'
import {MetricDTO} from './dashboard.model'

@Injectable({
  providedIn: 'root',
})
export class DashboardHttpService {
  private readonly baseUrl = 'http://localhost:3000'
  private http = inject(HttpClient)

  getMetrics(): Observable<MetricDTO[]> {
    return this.http.get<MetricDTO[]>(`${this.baseUrl}/dashboard/metrics`)
  }
}
