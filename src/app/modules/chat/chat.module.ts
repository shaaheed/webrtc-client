import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChatComponent } from './chat.component';
import { ChatRoutingModule } from './chat-routing.module';
import { ConversationModule } from 'src/app/components/conversation/conversation.module';


@NgModule({
  declarations: [
    ChatComponent
  ],
  imports: [
    ChatRoutingModule,
    ConversationModule,
    CommonModule
  ],
  exports: [ChatComponent]
})
export class ChatModule { }
