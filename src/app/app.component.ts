/**
 * @license
 * Copyright (C) 2020-2025 IoT.bzh Company
 * Contact: https://www.iot.bzh/licensing
 *
 * This file is part of the recovery-tools-binding module of the redpesk® project.
 *
 * $RP_BEGIN_LICENSE$
 * Commercial License Usage
 *  Licensees holding valid commercial IoT.bzh licenses may use this file in
 *  accordance with the commercial license agreement provided with the
 *  Software or, alternatively, in accordance with the terms contained in
 *  a written agreement between you and The IoT.bzh Company. For licensing terms
 *  and conditions see https://www.iot.bzh/terms-conditions. For further
 *  information use the contact form at https://www.iot.bzh/contact.
 *
 * GNU General Public License Usage
 *  Alternatively, this file may be used under the terms of the GNU General
 *  Public license version 3. This license is as published by the Free Software
 *  Foundation and appearing in the file LICENSE.GPLv3 included in the packaging
 *  of this file. Please review the following information to ensure the GNU
 *  General Public License requirements will be met
 *  https://www.gnu.org/licenses/gpl-3.0.html.
 * $RP_END_LICENSE$
 */
import { Component } from '@angular/core';
import { AFBWebSocketService } from './@core/services/AFB-websocket.service';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'rpr-root',
  template: '<router-outlet></router-outlet>',
  styleUrls: ['./app.component.scss'],
  standalone: false
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
