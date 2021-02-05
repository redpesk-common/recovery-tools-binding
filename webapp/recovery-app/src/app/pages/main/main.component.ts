import { DOCUMENT } from '@angular/common';
import { Component, ElementRef, HostListener, Inject, OnInit, Renderer2, ViewChild, ViewEncapsulation } from '@angular/core';
import { AFBWebSocketService } from 'afbwebsocket';
import { map, switchMap } from 'rxjs/operators';
import { LogsService } from './logs.service';
import { saveAs } from 'file-saver';
import { environment } from '../../../environments/environment';
import { BehaviorSubject, Observable } from 'rxjs';

export interface IBoardInfo {
  general: {
    serial: string;
    mac: string;
  },
  disk_usage: [
    {
      partition: string;
      name: string;
      usage: string
    }
  ],
  redpesk: {
    distribution: string;
    version_id: string;
  },
  recovery: {
    distribution: string;
    version_id: string;
  },
  boot_flags: {
    counter: string;
    limit: string;
    upgrade_available: string;
  }
}

@Component({
  selector: 'rpr-main',
  templateUrl: './main.component.html',
  styleUrls: ['./main.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class MainComponent implements OnInit {

  @ViewChild('tcontent') tcontent: ElementRef<any> = {} as ElementRef;
  code: string = '';
  private _boardInfo = <IBoardInfo>{
    general: {},
    disk_usage: [{}],
    redpesk: {},
    recovery: {},
    boot_flags: {},
  };
  boardInfo$ = new BehaviorSubject(this._boardInfo);

  /**
   * Reconnection counter and setinterval variable
   */
  _count: number = 0;
  private _reconnectInterval: any = null;

  /**
   * boolean variable to control flow
   */
  connected: boolean = false;
  runningAction: boolean = false;
  canceled: boolean = false;
  finishedAction: boolean = false;
  tryToReconnect: boolean = false;
  rebooting: boolean = false;
  recoveryEnd: boolean = false;
  factory: boolean = false;
  usb: boolean = false;

  /**
   * Config forms settings value for restoring
   */
  factoryConfig: any = {
    rootfs: true,
    data: false,
    config: false,
  }

  usbConfig: any = {
    rootfs: true,
    data: false,
    config: false,
  }
  progress: number = 0;

  constructor(
    private afbService: AFBWebSocketService,
    private logService: LogsService,
    private render: Renderer2,
    @Inject(DOCUMENT) private document: Document,
  ) {
    afbService.Init('api', 'HELLO');
  }

  ngOnInit(): void {
    /**
     * Set afb-daemon url
     */
    if (environment.production) {
      this.afbService.SetURL(window.location.host);
    } else {
      this.afbService.SetURL('localhost', '1234');
    }

    /**
     * afb-daemon connection
     */
    this.afbService.Connect();

    /**
     * Listen for afb-daemon events
     */
    this.afbService.Status$.pipe(
      switchMap((x: any) => {
        this.connected = x.connected;
        if (!this.connected && !this.tryToReconnect) {
          this._reconnect();
        }
        return this._loadBoardInfo();

      }),
      switchMap(() => {
        return this.afbService.OnEvent('*').pipe(map((d: any) => {
          if (d.event === 'recovery/admin/restore' || d.event === 'recovery/admin/reboot') {
            this._displayTerminal(d);
          }
          if (d.event === 'recovery/admin/info') {
            this._setBoardInfo(d);
          }
          // if (d.event === 'recovery/admin/reboot') {
          //   if (d.data.status && d.data.status.exit == 0) {
          //     setTimeout(() => {
          //       this.recoveryEnd = true;
          //     }, 5000);
          //   }
          // }
        }))
      })
    ).subscribe();



    // Prevent reload
    window.addEventListener("beforeunload", function (e) {
      var confirmationMessage = "\o/";
      e.returnValue = confirmationMessage;
      return confirmationMessage;
    });
  }

  private _loadBoardInfo(): Observable<any> {
    return this.afbService.Send('recovery/admin/info', `{"action":"start"`);
  }

  private _setBoardInfo(d: any) {
    if (d.data.recovery) {
      this._boardInfo.recovery.distribution = d.data.recovery.PRETTY_NAME;
      this._boardInfo.recovery.version_id = d.data.recovery.VERSION_ID;
    } else if (d.data.rootfs) {
      this._boardInfo.redpesk.distribution = d.data.rootfs.PRETTY_NAME;
      this._boardInfo.redpesk.version_id = d.data.rootfs.VERSION_ID;
    } else if (d.data.macaddr) {
      Object.keys(d.data.macaddr).forEach(v => {
        // this._boardInfo.general.mac = `${v}:` + (d.data.macaddr[v] ? d.data.macaddr[v] : '\'\'');
        this._boardInfo.general.mac = (d.data.macaddr[v] ? d.data.macaddr[v] : '\'\'');
      })
    } else if (d.data.disk_usage) {
      if(!this._boardInfo.disk_usage.find(b => b.name === d.data.disk_usage.name)) {
        this._boardInfo.disk_usage.push({
          name: d.data.disk_usage.name,
          partition: d.data.disk_usage.partition,
          usage: d.data.disk_usage.used,
        });
      }
    } else if(d.data.boot_flags) {
      this._boardInfo.boot_flags.limit = d.data.boot_flags.limit;
      this._boardInfo.boot_flags.counter = d.data.boot_flags.counter;
      this._boardInfo.boot_flags.upgrade_available = d.data.boot_flags.upgrade_available;
    } else if(d.data.available_mode) {
      this.factory = (d.data.available_mode.factory === '0' ? false : true);
      this.usb = (d.data.available_mode.usb  === '0' ? false : true);

    }
    this.boardInfo$.next(this._boardInfo);
  }

  private _displayTerminal(d: any) {
    this.logService.push(d);
    if (d.data.output) {
      if (d.data.output.match(/^\d{1,3}$/)) {
        this.progress = d.data.output;
      } else {
        this.code += '\n' + d.data.output;
      }
    }
    if (d.data.stderr) {
      this.code += '\n<span class="stderr">' + d.data.stderr.join('\n') + '</span>';
    }
    if (d.data.stdout) {
      this.code += `\n${d.data.stdout.join('\n')}`;
    }
    if (d.data.status && d.data.status.exit === 0) {
      if (!this.rebooting) {
        this.code += '\n' + "Finished."
        this.finishedAction = true;
      }
    }
    setTimeout(() => {
      if (this.tcontent) {
        this.tcontent.nativeElement.parentElement.scrollBy(0, this.tcontent.nativeElement.parentElement.scrollHeight);
      }
    });
  }

  reconnect(): void {
    this.tryToReconnect = false;
    this.afbService.Connect();
  }

  private _reconnect(): void {
    if (this._reconnectInterval === null) {
      this._reconnectInterval = setInterval(() => {
        if (this.connected) {
          clearInterval(this._reconnectInterval);
          this.tryToReconnect = false;
          this._reconnectInterval = null;
          return;
        }
        if (this._count > 2) {
          this.tryToReconnect = true;
          clearInterval(this._reconnectInterval);
          this._reconnectInterval = null;
          this._count = 0;
          return;
        }
        this.afbService.Connect();
        this._count++;
      }, 2000);
    }
  }

  recoverFactoryImage(form: any): void {
    let params: any = [];
    if (this.factoryConfig.rootfs) {
      params.push('rootfs');
    }
    if (this.factoryConfig.data) {
      params.push('data');
    }
    if (this.factoryConfig.config) {
      params.push('config');
    }

    if (params.length) {
      this.afbService.Send('recovery/admin/restore', `{"args":{"mode":"factory","part":"${params.join(',')}"}}`).subscribe(d => {
        this.logService.push({ command: `recovery/admin/restore, {"args":{"mode":"factory","part":"${params.join(',')}"}}` });
        this.logService.push(d);
        this.runningAction = true;
        this.canceled = false;
      });
      setTimeout(() => {
        this.tcontent.nativeElement?.offsetParent.scrollIntoView();
      }, 100);
    }
  }

  recoverUsbImage(form: any): void {
    let params: any = [];
    if (this.usbConfig.rootfs) {
      params.push('rootfs');
    }
    if (this.usbConfig.data) {
      params.push('data');
    }
    if (this.usbConfig.config) {
      params.push('config');
    }

    if (params.length) {
      this.afbService.Send('recovery/admin/restore', `{"args":{"mode":"usb","part":"${params.join(',')}"}}`).subscribe(d => {
        this.logService.push({ command: `recovery/admin/restore, {"args":{"mode":"usb","part":"${params.join(',')}"}}` });
        this.logService.push(d);
        this.runningAction = true;
        this.canceled = false;
      });
      setTimeout(() => {
        this.tcontent.nativeElement?.offsetParent.scrollIntoView();
      }, 100);
    }
  }

  cancel(): void {
    this.afbService.Send('recovery/admin/restore', `{"action":"stop", "args": {"signal":"sigterm"}}`).subscribe(d => {
      this.logService.push({ command: `recovery/admin/restore, {"action":"stop", "args": {"signal":"sigterm"}}` });
      this.logService.push(d);
      this.runningAction = false;
      this.canceled = true;
      this.progress = 0;
    });
  }

  reboot(): void {
    if (confirm('You are going to reboot the board. Make sure you have copied or downloaded log info.')) {
      this.rebooting = true;
      this.afbService.Send('recovery/admin/reboot', `{"action":"start"}`).subscribe(d => {
        this.logService.push(d);
      });
      setTimeout(() => {
        this.tcontent.nativeElement?.offsetParent.scrollIntoView();
      }, 100);
      setTimeout(() => {
        this.recoveryEnd = true;
      }, 6000);
    }
  }

  copyToClipboard(): void {
    const textarea = document.createElement('textarea');
    this.render.appendChild(this.document.activeElement, textarea);
    const value = this.code.replace(/<\/?[^>]+(>|$)/g, '');
    textarea.value = value;
    textarea.select();
    this.document.execCommand('copy');
    this.render.removeChild(this.document.activeElement?.parentElement, textarea);
  }

  checkForm(typeConfig: string): boolean {
    let disabled: any = false;
    var config = {};
    switch (typeConfig) {
      case 'factoryConfig':
        config = this.factoryConfig;
        break;
      case 'usbConfig':
        config = this.usbConfig;
        break;

      default:
        return true;
    }
    Object.entries(config).map((a: any) => {
      disabled |= a[1];
    });
    return !disabled;
  }

  showTerminal(): boolean {
    return this.runningAction || this.finishedAction || this.canceled || this.rebooting;
  }

  showProgress(): boolean {
    return this.runningAction && !this.finishedAction;
  }

  download(): void {
    let logs: any = {}
    logs.terminal = this.code.replace(/<\/?[^>]+(>|$)/g, '');
    logs.events = this.logService.getLogs();
    const file = new Blob([JSON.stringify(logs)], {
      type: 'text/plain;charset=utf-8'
    });
    saveAs(file, Date.now() + '-redpesk-recovery-logs.json');
  }
}
