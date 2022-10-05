import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { HttpService } from 'src/app/services/http.service';

@Component({
  selector: 'app-join',
  templateUrl: './join.component.html',
  styleUrls: ['./join.component.scss']
})
export class JoinComponent {

  constructor(
    private router: Router,
    private httpService: HttpService
  ) { }

  year: any;
  username: any;

  ngOnInit() {
    this.year = new Date().getFullYear();
  }

  join() {
    if (!this.username) {
      alert('Please enter a user name');
      return;
    }
    const socketId = sessionStorage.getItem('socket_id');
    this.httpService.post('join', {
      id: socketId,
      username: this.username
    }).subscribe(x => {
      if (x) {
        sessionStorage.setItem('username', this.username);
        this.router.navigateByUrl('/');
      }
    })
  }

  handleInput(e: any) {
    this.username = e.target.value;
  }
}
