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
import { DOCUMENT } from '@angular/common';
import { Component, ElementRef, HostListener, Inject, OnInit, Renderer2, ViewChild, ViewEncapsulation } from '@angular/core';
import { AFBWebSocketService } from '../../@core/services/AFB-websocket.service';
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
    gitTag: string = environment.GIT_TAG;
    year: string = new Date().getFullYear().toString();
    cachedImage: any;

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
        @Inject(Renderer2) private render: Renderer2,
        @Inject(DOCUMENT) private document: Document,
    ) {
        afbService.Init('api', 'HELLO');
    }

    ngOnInit(): void {
        this.cacheImage('../../../assets/404.png');
        
        /**
         * Set afb-daemon url
         */
        if (environment.production) {
            this.afbService.SetURL(window.location.host);
        } else {
            this.afbService.SetURL(window.location.host);
        }

        /**
         * afb-daemon connection
         */
        this.afbService.Connect();

        /**
         * Listen for afb-daemon events
         */
        this.afbService.Status$?.pipe(
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

    cacheImage(imageUrl: string) {
        fetch(imageUrl)
            .then(response => response.blob())
            .then(blob => {
                const objectURL = URL.createObjectURL(blob);
                this.cachedImage = objectURL;
            })
            .catch(error => console.error('Image caching failed:', error));
    }

    private _loadBoardInfo(): Observable<any> {
        return this.afbService.Send('recovery/admin/info', `{"action":"start"`);
    }

    private _setBoardInfo(d: any) {
        if (d.data.stdout) {
            if (d.data.stdout.recovery) {
                const recoveryPrettyName = d.data.stdout.recovery.PRETTY_NAME.split(' ').slice(2, 3).join(' ');
                this._boardInfo.recovery.distribution = recoveryPrettyName;
                this._boardInfo.recovery.version_id = d.data.stdout.recovery.VERSION_ID;
            } else if (d.data.stdout.rootfs) {
                this._boardInfo.redpesk.distribution = d.data.stdout.rootfs.PRETTY_NAME;
                this._boardInfo.redpesk.version_id = d.data.stdout.rootfs.VERSION_ID;
            } else if (d.data.stdout.macaddr) {
                Object.keys(d.data.stdout.macaddr).forEach(v => {
                    this._boardInfo.general.mac = (d.data.stdout.macaddr[v] ? d.data.stdout.macaddr[v] : '\'\'');
                })
            } else if (d.data.stdout.disk_usage) {
                if (!this._boardInfo.disk_usage.find(b => b.name === d.data.stdout.disk_usage.name)) {
                    this._boardInfo.disk_usage.push({
                        name: d.data.stdout.disk_usage.name,
                        partition: d.data.stdout.disk_usage.partition,
                        usage: d.data.stdout.disk_usage.used,
                    });
                }
            } else if (d.data.stdout.boot_flags) {
                this._boardInfo.boot_flags.limit = d.data.stdout.boot_flags.limit;
                this._boardInfo.boot_flags.counter = d.data.stdout.boot_flags.counter;
                this._boardInfo.boot_flags.upgrade_available = d.data.stdout.boot_flags.upgrade_available;
            } else if (d.data.stdout.available_mode) {
                this.factory = (d.data.stdout.available_mode.factory === '0' ? false : true);
                this.usb = (d.data.stdout.available_mode.usb === '0' ? false : true);

            }
            this.boardInfo$.next(this._boardInfo);
        }
        else {

        }
    }

    private _displayTerminal(d: any) {
        this.logService.push(d);
        if (d.data.stdout) {
            if (d.data.stdout.match(/^\d{1,3}$/)) {
                this.progress = d.data.stdout;
            } else {
                this.code += '\n' + d.data.stdout;
            }
        }
        if (d.data.stderr) {
            this.code += '\n<span class="stderr">' + d.data.stderr.toString() + '</span>';
        }
        if (d.data.status && d.data.status.exit === 0) {
            if (!this.rebooting) {
                this.code += '\n' + "Finished.";
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
            this.afbService.Send('recovery/admin/restore', `{"args":{"mode":"factory","part":"${params.join(',')}"}}`).subscribe((d: any) => {
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
            this.afbService.Send('recovery/admin/restore', `{"args":{"mode":"usb","part":"${params.join(',')}"}}`).subscribe((d:any) => {
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
        this.afbService.Send('recovery/admin/restore', `{"action":"stop", "args": {"signal":"sigterm"}}`).subscribe((d:any) => {
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
            this.afbService.Send('recovery/admin/reboot', `{"action":"start"}`).subscribe((d:any) => {
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
