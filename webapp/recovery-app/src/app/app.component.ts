import { Component } from '@angular/core';
import { AFBWebSocketService } from './@core/services/AFB-websocket.service';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'rpr-root',
  template: '<router-outlet></router-outlet>',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  title = 'recovery-app';

  constructor(
    private afbService: AFBWebSocketService
  ) {
    this.afbService.Init('api', 'HELLO');
   }

  ngOnInit(): void {
    if (environment.production) {
      this.afbService.SetURL(window.location.host);
    } else {
      this.afbService.SetURL(window.location.host);
    }
    this.afbService.Connect();
  }
}
