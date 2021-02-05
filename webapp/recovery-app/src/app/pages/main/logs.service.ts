import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class LogsService {

  private _events: string[] = [];

  constructor() { }

  push(log: any) {
    this._events.push(log);
  }

  getLogs(): any[] {
    return this._events;
  }
}
