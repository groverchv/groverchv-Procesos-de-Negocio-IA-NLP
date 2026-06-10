import { Injectable } from '@angular/core';
import { Client, IMessage } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { Subject, Observable } from 'rxjs';
import { ApiGlobalService } from '../api-global.service';

export interface ColaboracionUpdate {
  userId: string;
  userName: string;
  update?: string;
  content: string;
  timestamp: number;
}

@Injectable({
  providedIn: 'root'
})
export class DocumentSocketService {
  private stompClient: Client | null = null;
  private updatesSubject = new Subject<ColaboracionUpdate>();
  
  private currentDocId: string | null = null;
  public readonly currentUserId = 'user_' + Math.random().toString(36).substring(2, 7);

  constructor(private apiGlobal: ApiGlobalService) {}

  connect(docId: string): Observable<ColaboracionUpdate> {
    this.currentDocId = docId;

    if (this.stompClient?.active) {
      this.stompClient.deactivate();
    }

    this.stompClient = new Client({
      webSocketFactory: () => new SockJS(this.apiGlobal.wsUrl),
      heartbeatIncoming: 0,
      heartbeatOutgoing: 0,
      reconnectDelay: 2000,
    });

    this.stompClient.onConnect = () => {
      this.stompClient?.subscribe(`/topic/colaboracion/${docId}`, (message: IMessage) => {
        if (message.body) {
          try {
            const data: ColaboracionUpdate = JSON.parse(message.body);
            // Ignore updates sent by our own user id
            if (data.userId !== this.currentUserId) {
              this.updatesSubject.next(data);
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
      });
    };

    this.stompClient.activate();
    return this.updatesSubject.asObservable();
  }

  sendUpdate(docId: string, userName: string, content: string): void {
    if (this.stompClient?.connected) {
      const payload: ColaboracionUpdate = {
        userId: this.currentUserId,
        userName: userName,
        content: content,
        timestamp: Date.now()
      };
      this.stompClient.publish({
        destination: `/app/colaboracion/${docId}`,
        body: JSON.stringify(payload)
      });
    }
  }

  disconnect(): void {
    if (this.stompClient?.active) {
      this.stompClient.deactivate();
      this.stompClient = null;
    }
  }
}
