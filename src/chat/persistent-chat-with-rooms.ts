import { Server } from 'http';
import socket from 'socket.io';

import { IClientHooks, IMiddleware, SocketListener } from '../types';
import { listen } from '../listeners';

export class PersistentChatWithRooms {
  private chat: socket.Namespace;
  private hooks: IClientHooks = {};

  private prepareNewClient(client: socket.Socket): void {
    listen(client, this.hooks);
  }

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

  setClientHooks(hooks: IClientHooks = {}) {
    this.hooks = hooks;
    return this;
  }

  start() {
    this.chat.on('connect', socket => this.prepareNewClient(socket));
    return this;
  }

  setRooms(user: string, rooms: string[]) {
    Object.values(this.chat.sockets)
      .filter(socket => socket.request.user === user)
      .forEach(client => rooms.forEach(room => client.join(room)));
  }

  getServer() {
    return this.chat;
  }
}
