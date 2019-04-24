import socket from 'socket.io';

export type Listener = (socket: socket.Socket, data: any) => any;

export type BeforeAfterHooks<Callback> = [Callback, Callback];

export interface IClientHooks {
  userLogin?: BeforeAfterHooks<Listener>;
  userLogout?: BeforeAfterHooks<Listener>;

  roomList?: BeforeAfterHooks<Listener>;
  roomVisit?: BeforeAfterHooks<Listener>;
  roomGet?: BeforeAfterHooks<Listener>;
  roomCreate?: BeforeAfterHooks<Listener>;
  roomJoin?: BeforeAfterHooks<Listener>;
  roomInvite?: BeforeAfterHooks<Listener>;

  message?: BeforeAfterHooks<Listener>;
};

export interface IMiddleware {
  (data: socket.Socket, next: CallableFunction): void;
}

export interface SocketListener {
  (socket: socket.Socket): void;
}
