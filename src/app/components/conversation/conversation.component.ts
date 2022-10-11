import { ApplicationRef, Component, ElementRef, Input, ViewChild } from '@angular/core';
import { Socket } from 'ngx-socket-io';
import { HttpService } from 'src/app/services/http.service';
import { StunServers } from 'src/app/stun.servers';

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
  @ViewChild('localVideoElementRef', { static: true }) localVideoElementRef?: ElementRef;
  @ViewChild('remoteVideoElementRef', { static: true }) remoteVideoElementRef?: ElementRef;

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

  private localVideoElement?: HTMLVideoElement;
  private remoteVideoElement?: HTMLVideoElement;

  private localStream?: MediaStream;
  private remoteStream?: MediaStream;

  private peerConnection?: RTCPeerConnection;
  private callStartTime: any;
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

    this.socket.on('onicecandidate', (e: any) => {
      console.log('onicecandidate for: ', e.to);
      this.peerConnection?.addIceCandidate(e.candidate);
    });

    this.socket.on('oncall', (e: any) => {
      this.peerConnection = new RTCPeerConnection({ iceServers: StunServers.getServers() });

      this.isCallee = true;
      this.isCaller = false;
      this.inACall = true;

      this.currentUserToChat = this.users?.find(x => x.id == e.from) || this.currentUserToChat;
      this.fromUsername = this.users?.find(x => x.id == e.from)?.username || this.fromUsername;
      this.callerOrCalleeName = this.fromUsername;

      console.log(`to: got a call from ${this.fromUsername}`);

      this.peerConnection.onicecandidate = (e) => {
        console.log('to: onicecandidate');
        this.httpService.post('icecandidate', { to: this.currentUserToChat?.id, candidate: e.candidate }).subscribe(x => { });
      }

      this.peerConnection.ontrack = (e) => {
        console.log('to: on track');
        if (this.remoteVideoElement) {
          const [stream] = e.streams;
          this.remoteStream = stream;
          this.remoteVideoElement.srcObject = stream;
          this.setCallerOrCalleeMuted(stream.getTracks());
          this.startCallTimer();
        }
      }

      this.peerConnection.ondatachannel = (e) => {
        const channel = e.channel;
        console.log('to: ondatachannel');
        channel.onmessage = (e) => {
          console.log(`to: ${this.toUsername} got a message: ${e.data} from ${this.fromUsername}`);
        };
        channel.onopen = (e) => {
          console.log('to: webtrc connection oppened');
        }
        channel.onclose = (e) => {
          console.log('to: onclose');
          this.handleOnCallEnded();
        }
      }

      navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then(stream => {
          this.localStream = stream;
          this.setVideo(stream, this.localVideoElement, this.peerConnection);
          if (this.localVideoElement) {
            this.localVideoElement.muted = true;
          }
        })
        .then(() => this.peerConnection?.setRemoteDescription(e.offer))
        .then(() => console.log('to: webtrc offer setted'))
        .then(() => this.peerConnection?.createAnswer())
        .then(answer => this.peerConnection?.setLocalDescription(answer))
        .then(() => {
          console.log('to: webrtc answer created');
          console.log(`to: receiving a call from ${this.fromUsername}`);
          setTimeout(() => {
            this.httpService.post('receive', {
              answer: this.peerConnection?.localDescription,
              from: e.to,
              to: e.from,
            }).subscribe(a => { });
          }, 1000)
        });

    });

    this.socket.on('onreceive', (e: any) => {
      if (this.peerConnection && !this.peerConnection.currentRemoteDescription) {
        this.peerConnection?.setRemoteDescription(e.answer)
          .then(() => console.log('set remote description'));
      }
    });

  }

  ngAfterViewInit() {
    this.localVideoElement = this.localVideoElementRef?.nativeElement;
    this.remoteVideoElement = this.remoteVideoElementRef?.nativeElement;
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

    this.peerConnection = new RTCPeerConnection({ iceServers: StunServers.getServers() });

    this.peerConnection.onicecandidate = (e) => {
      console.log('from: onicecandidate');
      this.httpService.post('icecandidate', { to: this.currentUserToChat?.id, candidate: e.candidate }).subscribe(x => { });
    }

    this.peerConnection.ontrack = (e) => {
      console.log('from: on track');
      if (this.remoteVideoElement) {
        const [stream] = e.streams;
        this.remoteStream = stream;
        this.remoteVideoElement.srcObject = stream;
        this.setCallerOrCalleeMuted(stream.getTracks());
        this.startCallTimer();
      }
    }

    const channel = this.peerConnection.createDataChannel("channel");
    channel.onmessage = (e) => {
      console.log(`from: ${this.fromUsername} got a message: ${e.data} from ${this.toUsername}`);
    }

    channel.onopen = (e) => {
      console.log('from: webrtc connection oppend');
    }

    channel.onclose = (e) => {
      console.log('from: onclose');
      this.handleOnCallEnded();
    }

    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(stream => {
        this.localStream = stream;
        this.setVideo(stream, this.localVideoElement, this.peerConnection);
        if (this.localVideoElement) {
          this.localVideoElement.muted = true;
        }
      })
      .then(() => this.peerConnection?.createOffer())
      .then(offer => this.peerConnection?.setLocalDescription(offer))
      .then(() => {
        setTimeout(() => {
          console.log(`from: webrtc offer created`);
          console.log(`from: initiating a call to ${this.toUsername}`);
          this.httpService.post('call', {
            offer: this.peerConnection?.localDescription,
            to: this.currentUserToChat.id,
            from: this.socketId,
          }).subscribe(y => { });
        }, 1000);
      });
  }

  setVideo(stream?: MediaStream, element?: HTMLVideoElement, rtcConnection?: RTCPeerConnection) {
    if (stream) {
      if (element) {
        element.srcObject = stream;
      }
      if (rtcConnection) {
        stream.getTracks().forEach((track: MediaStreamTrack) => {
          rtcConnection.addTrack(track, stream);
        });
      }
    }
  }

  handleMute() {
    this.mute = !this.mute;
    this.enableAudioTrack(this.localStream?.getTracks() ?? [], this.mute);
  }

  handleVideoMute() {
    this.videoOn = !this.videoOn;
    this.enableVideoTrack(this.localStream?.getTracks() ?? [], this.videoOn);
  }

  handleCallEnd() {
    this.peerConnection?.close();
  }

  handleFullScreen() {
    if (this.remoteVideoElement?.requestFullscreen) {
      this.remoteVideoElement?.requestFullscreen();
    } else if ((this.remoteVideoElement as any)?.webkitRequestFullscreen) { /* Safari */
      (this.remoteVideoElement as any).webkitRequestFullscreen();
    } else if ((this.remoteVideoElement as any)?.msRequestFullscreen) { /* IE11 */
      (this.remoteVideoElement as any).msRequestFullscreen();
    }
  }

  startCallTimer() {
    if (this.interval) {
      clearInterval(this.interval);
    }
    this.callStartTime = Date.now();
    this.interval = setInterval(() => {
      const diff = Date.now() - this.callStartTime;
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
    this.localStream?.getTracks()?.forEach((x: MediaStreamTrack) => x.stop());
    this.remoteStream?.getTracks()?.forEach((x: MediaStreamTrack) => x.stop());
    if (this.interval) {
      clearInterval(this.interval);
    }
    this.interval = null;
    this.localStream = undefined;
    this.remoteStream = undefined;
    this.peerConnection = undefined;
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
