import { Injectable } from '@angular/core';
import { Client, IMessage } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { Subject, Observable, BehaviorSubject } from 'rxjs';
import { Modeling } from '../services/types';
import { ApiGlobalService } from '../services/api-global.service';

@Injectable({
  providedIn: 'root'
})
export class ModelingSocketService {
  private stompClient: Client | null = null;

  // ★ FLAT Modeling — no wrapper object
  private modelingSubject = new Subject<Modeling>();

  private connectedCountSubject = new BehaviorSubject<number>(0);
  connectedCount$ = this.connectedCountSubject.asObservable();

  private cursorsSubject = new BehaviorSubject<any>({});
  cursors$ = this.cursorsSubject.asObservable();

  private currentDesignId: string | null = null;
  public readonly currentUserId = 'user_' + Math.random().toString(36).substring(2, 7);

  constructor(private apiGlobal: ApiGlobalService) {}

  connect(designId: string): Observable<Modeling> {
    this.currentDesignId = designId;

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
      // ★ MODELING CHANNEL — parse flat payload directly
      this.stompClient?.subscribe(`/topic/modeler/${designId}`, (message: IMessage) => {
        if (message.body) {
          try {
            const m: Modeling = JSON.parse(message.body);
            // ★ FIX: emit the flat object directly — no wrapper check
            this.modelingSubject.next(m);
          } catch (e) {
            console.error('[WS] parse error', e);
          }
        }
      });

      // PRESENCE CHANNEL
      this.stompClient?.subscribe(`/topic/presence/${designId}`, (message: IMessage) => {
        if (message.body) {
          const data = JSON.parse(message.body);
          if (data.count !== undefined) this.connectedCountSubject.next(data.count);
          if (data.cursors) {
            const others = { ...data.cursors };
            delete others[this.currentUserId];
            this.cursorsSubject.next(others);
          }
        }
      });

      // Join presence
      this.stompClient?.publish({
        destination: `/app/presence/${designId}`,
        body: JSON.stringify({ action: 'join', userId: this.currentUserId })
      });
    };

    this.stompClient.activate();
    return this.modelingSubject.asObservable();
  }

  sendUpdate(designId: string, modeling: Modeling, isDragPulse = false): void {
    if (this.stompClient?.connected) {
      // ★ Send flat — modeling already contains senderId + timestamp from the component
      this.stompClient.publish({
        destination: `/app/modeler/${designId}`,
        body: JSON.stringify(modeling)
      });
    }
  }

  sendCursor(designId: string, x: number, y: number): void {
    if (this.stompClient?.connected) {
      this.stompClient.publish({
        destination: `/app/presence/cursor/${designId}`,
        body: JSON.stringify({ userId: this.currentUserId, x, y })
      });
    }
  }

  disconnect(): void {
    if (this.stompClient?.active) {
      this.stompClient.deactivate();
    }
  }
}
