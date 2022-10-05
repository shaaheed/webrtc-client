import { ApplicationRef, Component, Input, ViewChild } from '@angular/core';
import { Socket } from 'ngx-socket-io';
import { HttpService } from 'src/app/services/http.service';

@Component({
  selector: 'app-conversation',
  templateUrl: './conversation.component.html',
  styleUrls: ['./conversation.component.scss']
})
export class ConversationComponent {

  constructor(
    private socket: Socket,
    private httpService: HttpService,
    private appRef: ApplicationRef
  ) { }

  @Input() users: any[] = [];
  @ViewChild('fromVideoElement', { static: true }) fromVideoElement?: any;
  @ViewChild('toVideoElement', { static: true }) toVideoElement?: any;

  socketId: any;
  toUsername: any;
  fromUsername: any;
  currentUserToChat: any;
  currentMessage: any = "";

  mute = true;
  videoOn = true;
  audioOn = true;
  inACall = false;
  isCaller = false;
  isCallee = false;
  callerOrCalleeName: any;
  callerOrCalleeMuted: any;
  callDuration = "00:00:00";

  private fromRtcConnection?: RTCPeerConnection;
  private fromChannel?: RTCDataChannel;
  private toRtcConnection?: RTCPeerConnection;
  private toChannel?: RTCDataChannel;
  private callInitTime: any;
  private tracks: MediaStreamTrack[] = [];
  private interval: any;

  ngOnInit() {
    this.socketId = sessionStorage.getItem('socket_id');
    this.toUsername = sessionStorage.getItem('username');

    this.socket.on('onmessage', (e: any) => {
      const conversationId = e.conversationId;
      const messageTime = this.convertMessageTime(e.messageTime);
      const message = {
        from: e.from,
        to: e.to,
        conversationId: conversationId,
        message: e.message,
        messageTime: messageTime
      };
      let index = this.users.findIndex(x => x.conversationId == conversationId);
      if (index == -1) {
        index = this.users.findIndex(x => x.id == e.from);
      }

      if (index != -1) {
        if (!this.users[index].conversationId) {
          this.users[index].conversationId = conversationId;
        }
        if (!this.users[index]?.messages?.length) {
          this.users[index].messages = [];
        }
        this.users[index].messages.push(message);
        this.users[index].lastMessage = e.message;
        this.users[index].lastMessageTime = messageTime;
        if (message && !this.fromUsername) {
          this.fromUsername = this.getFromUsername(message)
        }
      }

    });

    // this.socket.on('onicecandidate', (e: any) => {
    //   if (e.for == 'from' && this.fromRtcConnection) {
    //     this.fromRtcConnection.addIceCandidate(e.candidate);
    //   }
    //   else if (e.for == "to" && this.toRtcConnection) {
    //     this.toRtcConnection.addIceCandidate(e.candidate);
    //   }
    // });

    this.socket.on('oncall', (e: any) => {
      this.toRtcConnection = new RTCPeerConnection();

      this.isCallee = true;
      this.isCaller = false;
      this.inACall = true;

      this.currentUserToChat = this.users?.find(x => x.id == e.from) || this.currentUserToChat;
      this.fromUsername = this.users?.find(x => x.id == e.from)?.username || this.fromUsername;
      this.callerOrCalleeName = this.fromUsername;

      console.log(`to: got a call from ${this.fromUsername}`);

      // this.toRtcConnection.onicecandidate = (e) => {
      //   console.log('toRtcConnection.onicecandidate');
      //   this.httpService.post('icecandidate', { for: 'from', candidate: e.candidate }).subscribe(x => { });
      // }

      this.toRtcConnection.ontrack = (e) => {
        console.log('to: on track');
        if (this.toVideoElement) {
          const [stream] = e.streams;
          this.toVideoElement.nativeElement.srcObject = stream;
          this.setCallerOrCalleeMuted(stream.getTracks());
        }
        this.startCallTimer();
      }

      this.toRtcConnection.ondatachannel = (e) => {
        this.toChannel = e.channel;
        console.log('to: ondatachannel');
        this.toChannel.onmessage = (e) => {
          console.log(`to: ${this.toUsername} got a message: ${e.data} from ${this.fromUsername}`);
        };
        this.toChannel.onopen = (e) => {
          console.log('to: webtrc connection oppened');
        }
        this.toChannel.onclose = (e) => {
          console.log('to: onclose');
          this.handleOnCallEnded();
        }
      }

      navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then(stream => this.setVideo(stream, this.fromVideoElement, this.toRtcConnection))
        .then(() => this.toRtcConnection?.setRemoteDescription(e.offer))
        .then(() => console.log('to: webtrc offer setted'))
        .then(() => this.toRtcConnection?.createAnswer())
        .then(answer => this.toRtcConnection?.setLocalDescription(answer))
        .then(() => {
          console.log('to: webrtc answer created');
          console.log(`from: receiving a call from ${this.fromUsername}`);
          setTimeout(() => {
            this.httpService.post('receive', {
              answer: this.toRtcConnection?.localDescription,
              from: e.to,
              to: e.from,
            }).subscribe(a => { });
          }, 1000)
        });

    });

    this.socket.on('onreceive', (e: any) => {
      console.log('onreceive -----', e);
      this.fromRtcConnection?.setRemoteDescription(e.answer)
        .then(() => console.log('set remote description'));
    });

  }

  setCurrentUserToChat(user: any) {
    this.currentUserToChat = user;
    if (!this.currentUserToChat?.messages) {
      this.currentUserToChat.messages = [];
    }
    if (this.currentUserToChat.messages.length) {
      this.fromUsername = this.getFromUsername(this.currentUserToChat.messages[0]);
    }
  }

  handleCurrentMessage(e: any) {
    this.currentMessage = e.target.value;
  }

  sendMessage() {
    if (this.currentMessage?.trim()) {
      const conversationId = this.currentUserToChat.conversationId || new Date().getTime().toString();
      this.currentUserToChat.conversationId = conversationId;
      const messageTime = Date.now();
      const messageToSend = {
        from: this.socketId,
        to: this.currentUserToChat.id,
        conversationId: conversationId,
        message: this.currentMessage,
        messageTime: messageTime,
      };
      if (!this.currentUserToChat?.messages) {
        this.currentUserToChat.messages = [];
      }
      const localMessage: any = { ...messageToSend };
      localMessage.messageTime = this.convertMessageTime(localMessage.messageTime);
      this.currentUserToChat.messages.push(localMessage);
      this.httpService.post('message', messageToSend).subscribe(x => { });
      this.currentUserToChat.lastMessage = this.currentMessage;
      this.currentUserToChat.lastMessageTime = this.convertMessageTime(messageTime);
      this.currentMessage = "";
    }
  }

  startCall() {
    this.isCallee = false;
    this.isCaller = true;
    this.inACall = true;

    this.callerOrCalleeName = this.currentUserToChat?.username;

    // this.fromRtcConnection.onicecandidate = (e) => {
    //   console.log('fromRtcConnection.onicecandidate');
    //   this.httpService.post('icecandidate', { for: 'to', candidate: e.candidate }).subscribe(x => { });
    // }

    this.fromRtcConnection = new RTCPeerConnection();

    this.fromRtcConnection.ontrack = (e) => {
      console.log('from: on track');
      if (this.toVideoElement) {
        const [stream] = e.streams;
        this.toVideoElement.nativeElement.srcObject = stream;
        this.setCallerOrCalleeMuted(stream.getTracks());
      }

      this.startCallTimer();
    }

    // this.fromRtcConnection.onnegotiationneeded = (e) => {
    //   console.log('fromRtcConnection.onnegotiationneeded', e);
    // }

    this.fromChannel = this.fromRtcConnection.createDataChannel("channel")
    this.fromChannel.onmessage = (e) => {
      console.log(`from: ${this.fromUsername} got a message: ${e.data} from ${this.toUsername}`);
    }

    this.fromChannel.onopen = (e) => {
      console.log('from: webrtc connection oppend');
    }

    this.fromChannel.onclose = (e) => {
      console.log('from: onclose');
      this.handleOnCallEnded();
    }

    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(stream => this.setVideo(stream, this.fromVideoElement, this.fromRtcConnection))
      .then(() => this.fromRtcConnection?.createOffer())
      .then(offer => this.fromRtcConnection?.setLocalDescription(offer))
      .then(() => {
        setTimeout(() => {
          console.log(`from: webrtc offer created`);
          console.log(`from: initiating a call to ${this.toUsername}`);
          this.httpService.post('call', {
            offer: this.fromRtcConnection?.localDescription,
            to: this.currentUserToChat.id,
            from: this.socketId,
          }).subscribe(y => { });
        }, 1000);
      });
  }

  setVideo(stream: any, element: any, rtcConnection: any) {
    if (stream) {
      if (element) {
        element.nativeElement.srcObject = stream;
      }
      if (rtcConnection) {
        stream.getTracks().forEach((track: MediaStreamTrack) => {
          this.tracks.push(track);
          rtcConnection.addTrack(track, stream);
        });
      }
    }
  }

  handleMute() {
    this.mute = !this.mute;
    this.enableAudioTrack(this.tracks, this.mute);
  }

  handleVideoMute() {
    this.videoOn = !this.videoOn;
    this.enableVideoTrack(this.tracks, this.videoOn);
  }

  handleCallEnd() {
    this.fromRtcConnection?.close();
    this.toRtcConnection?.close();
  }

  startCallTimer() {
    if (this.interval) {
      clearInterval(this.interval);
    }
    this.callInitTime = Date.now();
    this.interval = setInterval(() => {
      const diff = Date.now() - this.callInitTime;
      let t = diff;
      const h = Math.floor(t / 1000 / 60 / 60);
      t -= h * 1000 * 60 * 60;
      const m = Math.floor(t / 1000 / 60);
      t -= m * 1000 * 60;
      const s = Math.floor(t / 1000);
      this.callDuration = `${this.padding(h)}:${this.padding(m)}:${this.padding(s)}`;
      this.appRef.tick();
    }, 1000);
  }

  handleOnCallEnded() {
    this.inACall = false;
    this.isCaller = false;
    this.isCallee = false;
    this.tracks?.forEach((x: MediaStreamTrack) => x.stop());
    this.tracks = [];
    if (this.interval) {
      clearInterval(this.interval);
    }
    this.interval = null;
  }

  setCallerOrCalleeMuted(tracks: MediaStreamTrack[]) {
    const audio = this.getAudioTrack(tracks);
    if (audio) {
      audio.onmute = e => this.callerOrCalleeMuted = true;
      audio.onunmute = e => this.callerOrCalleeMuted = false;
    }
  }

  getAudioTrack(tracks: MediaStreamTrack[]) {
    return this.getTrack(tracks, "audio");
  }

  enableAudioTrack(tracks: MediaStreamTrack[], enable: boolean) {
    this.enableTrack(tracks, "audio", enable);
  }

  getVideoTrack(tracks: MediaStreamTrack[]) {
    return this.getTrack(tracks, "video");
  }

  enableVideoTrack(tracks: MediaStreamTrack[], enable: boolean) {
    this.enableTrack(tracks, "video", enable);
  }

  enableTrack(tracks: MediaStreamTrack[], kind: string, enable: boolean) {
    const track = this.getTrack(tracks, kind);
    if (track) {
      track.enabled = enable;
    }
  }

  getTrack(tracks: MediaStreamTrack[], kind: string) {
    return tracks?.find(x => x.kind == kind && x.readyState == "live");
  }

  padding(value: any) {
    return value > 9 ? value : `0${value}`;
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
