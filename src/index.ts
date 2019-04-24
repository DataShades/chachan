import { Server } from 'http';

import socket from 'socket.io';

export interface IMiddleware {
  (data: socket.Socket, next: CallableFunction): void;
}
export class PersistentChatWithRooms {
  private chat: socket.Namespace;

  constructor(server: Server|number, _opts?: any) {
    this.chat = socket(server).of('chachan/chat')
  }

  use(...middlewares: IMiddleware[]) {
    middlewares.forEach(middleware => this.chat.use(middleware))
  }

  setUpServer() {
    this.chat.on('connect', socket => {
      socket.on('message', data => socket.broadcast.send(data))
      console.log(`Connected: ${socket.id}`);
      socket.send(`Hello, ${socket.id}!`)
      socket.broadcast.send(`[new member] ${socket.id}`);
      socket.on('disconnect',  () => {
        console.log(`Disconnected: ${socket.id}`);
      })
    });
  }
}
