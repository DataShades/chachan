import { Server } from 'http';
import { IClientHooks, IMiddleware, SocketListener } from './types';
import {listen} from './listeners';
import socket from 'socket.io';

export class PersistentChatWithRooms {
  private chat: socket.Namespace;
  private hooks: IClientHooks = {};

  constructor(server: Server | number, _opts?: any) {
    this.chat = socket(server).of('chachan/chat');
  }

  use(...middlewares: IMiddleware[]) {
    middlewares.forEach(middleware => this.chat.use(middleware));
    return this;
  }

  on(event: string, listener: SocketListener) {
    this.chat.on(event, listener);
    return this;
  }

  private prepareNewClient(client: socket.Socket): void {
    listen(client, this.hooks, this.chat)
  }

  setClientHooks(hooks: IClientHooks = {}) {
    this.hooks = hooks;
    return this;
  }

  start() {
    this.chat.on('connect', socket => this.prepareNewClient(socket));
    return this;
  }
}
