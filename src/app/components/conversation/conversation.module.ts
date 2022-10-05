import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConversationComponent } from './conversation.component';


@NgModule({
  declarations: [
    ConversationComponent
  ],
  imports: [
    CommonModule
  ],
  exports: [ConversationComponent]
})
export class ConversationModule { }
