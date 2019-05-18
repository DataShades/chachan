import socket from 'socket.io';

export interface IMiddleware {
  (data: socket.Socket, next: CallableFunction): void;
}
export interface SocketListener {
  (socket: socket.Socket): void;
}

export type HookName = 'before' | 'on' | 'after';
export type HookListener = (socket: socket.Socket, data?: any, callback?: CallableFunction) => any;
export type Hooks = { [key: string]: { [name in HookName]?: HookListener } };

///////////////////////////////////////////////////////////////////////////////
//                                 deprecated                                //
///////////////////////////////////////////////////////////////////////////////
export type Listener = (socket: socket.Socket, data: any) => any;
export type BeforeAfterHooks<Callback> = { [name: string]: Callback | void };
export interface IClientHooks {
  userLogin?: BeforeAfterHooks<Listener>;
  userLogout?: BeforeAfterHooks<Listener>;

  roomList?: BeforeAfterHooks<Listener>;
  roomVisit?: BeforeAfterHooks<Listener>;
  roomDetails?: BeforeAfterHooks<Listener>;
  roomCreate?: BeforeAfterHooks<Listener>;
  roomJoin?: BeforeAfterHooks<Listener>;
  roomLeave?: BeforeAfterHooks<Listener>;
  roomInvite?: BeforeAfterHooks<Listener>;
  roomExpell?: BeforeAfterHooks<Listener>;
  message?: BeforeAfterHooks<Listener>;
}
