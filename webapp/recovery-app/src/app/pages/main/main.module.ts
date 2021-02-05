import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MainComponent } from './main.component';
import { MainRoutingModule } from './main-routing.module';
import { NgbAccordionModule, NgbProgressbarModule, NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
import { FormsModule } from '@angular/forms';
import { AfbwebsocketModule } from 'afbwebsocket';



@NgModule({
  declarations: [MainComponent],
  imports: [
    CommonModule,
    MainRoutingModule,
    NgbAccordionModule,
    FormsModule,
    AfbwebsocketModule,
    NgbProgressbarModule,
    NgbTooltipModule,
  ]
})
export class MainModule { }
