import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { JoinComponent } from './join.component';
import { JoinRoutingModule } from './join-routing.module';


@NgModule({
  declarations: [
    JoinComponent
  ],
  imports: [
    JoinRoutingModule,
    CommonModule
  ],
  exports: [JoinComponent]
})
export class JoinModule { }
