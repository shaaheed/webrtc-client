import { Component, ViewChild } from '@angular/core';
import { Socket } from 'ngx-socket-io';
import { ConversationComponent } from 'src/app/components/conversation/conversation.component';
import { HttpService } from 'src/app/services/http.service';

@Component({
  selector: 'app-chat',
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.scss']
})
export class ChatComponent {

  constructor(
    private socket: Socket,
    private httpService: HttpService
  ) { }

  socketId: any;
  users: any[] = [];
  currentUserToChat: any = null;
  @ViewChild('conversation', { static: true }) conversation?: ConversationComponent;

  ngOnInit() {
    this.socketId = sessionStorage.getItem('socket_id');

    // this.users.push({
    //   id: 123456,
    //   username: 'Just Name',
    //   lastMessage: "this is last message",
    //   lastMessageTime: Date.now(),
    //   message: [],
    //   status: 'away',
    //   unreadCount: 10,
    // })

    this.httpService.get('users').subscribe((users: any) => {
      const _users = users.filter((x: any) => x.id != this.socketId);
      _users.forEach((x: any) => {
        const ctor = x.lastMessageTime?.constructor?.name;
        if (ctor === "Number") {
          x.lastMessageTime = this.convertMessageTime(x.lastMessageTime);
        }
      });
      this.users = _users;
    });

    this.socket.on('ondisconnect', (user: any) => {
      console.log('ondisconnect', user);
      const index = this.users.findIndex(x => x.id == user.id);
      if (index != -1) {
        this.users.splice(index, 1);
      }
    });

    console.log('listening onjoin...');
    this.socket.on('onjoin', (user: any) => {
      console.log('onjoin', user)
      if (!this.users.find(x => x.id == user.id)) {
        user.lastMessageTime = this.convertMessageTime(user.lastMessageTime);;
        this.users.push(user);
      }
    });
  }

  handleUserClick(user: any) {
    this.conversation?.setCurrentUserToChat(user);
  }

  getFromUsername(message: any) {
    if (message) {
      const user = this.users.find(x => x.id == message.from);
      if (user) {
        return user.username
      }
    }
    return ""
  }

  convertMessageTime(time: any) {
    return time ? new Date(time).toLocaleString() : '';
  }

  getConversationId() {
    const conversationId = this.currentUserToChat.conversationId || new Date().getTime().toString();
    this.currentUserToChat.conversationId = conversationId;
    return conversationId
  }
}
