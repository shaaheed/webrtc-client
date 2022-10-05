import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { Socket } from 'ngx-socket-io';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {

  constructor(
    private socket: Socket,
    private router: Router,
  ) { }

  socketId: any;
  username: any;

  ngOnInit() {
    this.socketId = sessionStorage.getItem('socket_id') || '';
    this.socket.on('onconnection', (e: any) => {
      const oldSocketId = sessionStorage.getItem('socket_id');
      if (oldSocketId != e.id) {
        this.socketId = e.id;
        sessionStorage.setItem('socket_id', this.socketId);
        sessionStorage.removeItem('username');
        // this.router.navigateByUrl('/join');
      }
    });

    this.socket.on('onjoin', (user: any) => {
      if (this.socketId == user.id) {
        this.username = user.username;
        document.title = "Client - " + this.username;
      }
    });
  }
}
