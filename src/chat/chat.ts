import { Server } from 'http';
import socket from 'socket.io';

import { Hooks, IMiddleware, SocketListener } from '../types';
import { listenWithHooks, nativeHooks } from '../listeners';
export interface IChatOptions {
  /**
   * Chat's namespace, i.e `http://localhost:3000/NAMESPACE/OF/CHAT`
   * will be entrypoint for chat if you've provided
   * `NAMESPACE/OF/CHAT` as value for this option.
   */
  ns?: string;

  /**
   * List of events that'll have native hooks applied to them in
   * lifecycle(in addition to default ones).
   */
  hookedEvents?: string[];
  /**
   * Completely replace original list of hooked events instead of
   * extending it.
   */
  ignoreNativeHookedEvents?: boolean;
}

export class Chat {
  private server: socket.Server;
  private chat: socket.Namespace;
  private hooks: Hooks = {
    userLogin: { on: nativeHooks.userLogin },
    userLogout: { on: nativeHooks.userLogout },
    roomList: { on: nativeHooks.roomList },
    roomDetails: { on: nativeHooks.roomDetails },
    roomVisit: { on: nativeHooks.roomVisit },
    roomCreate: { on: nativeHooks.roomCreate },
    roomJoin: { on: nativeHooks.roomJoin },
    roomInvite: { on: nativeHooks.roomInvite },
    message: { on: nativeHooks.message },
  };
  private hookedEvents: string[] = [
    'user:login',
    'user:logout',
    'room:list',
    'room:details',
    'room:visit',
    'room:create',
    'room:join',
    'room:invite',
    'message',
  ];

  private prepareNewClient(client: socket.Socket): void {
    listenWithHooks(client, this.hooks, this.hookedEvents);
  }

  constructor(server: Server | number, serverOpts?: any, chatOpts: IChatOptions = {}) {
    this.server = socket(server, serverOpts);
    const { ignoreNativeHookedEvents = false, hookedEvents = [], ns = '' } = chatOpts;

    this.chat = this.server.of(ns);
    this.hookedEvents = ignoreNativeHookedEvents ? hookedEvents : this.hookedEvents.concat(hookedEvents);
  }

  /**
   * List all available events that use hooks.
   */
  getHookedEvents() {
    return this.hookedEvents;
  }

  /**
   * Apply additional middlewares to connections. Middleware is a
   * function that will be called on every new connection with
   * connection itself as a first argument and `next()` function as a
   * second argument. When middleware finishes, `next()` function must
   * be called in order to proceed with all other connection
   * initialization logic.
   */
  use(...middlewares: IMiddleware[]) {
    middlewares.forEach(middleware => this.chat.use(middleware));
    return this;
  }

  /**
   * Add event listeners to server instance.
   *
   * NOTE: You can only listen global server event here. For example,
   * `message` event from particular client cannot be observed with
   * this method, use `hooks` instead.
   */
  on(event: string, listener: SocketListener) {
    this.chat.on(event, listener);
    return this;
  }

  /**
   * Register additional hooks for hookedEvents
   */
  addClientHooks(hooks: Hooks = {}) {
    for (let [key, value] of Object.entries(hooks)) {
      this.hooks[key] = Object.assign({}, this.hooks[key], value);
    }
    return this;
  }

  /**
   * Replace all existing hooks.
   */
  replaceClientHooks(hooks: Hooks = {}) {
    this.hooks = hooks;
    return this;
  }
  /**
   * Drop all handlers for specified hook.
   */
  dropClientHook(hook: string) {
    delete this.hooks[hook];
    return this;
  }

  /**
   * Start listening on new connections.
   */
  start() {
    this.chat.on('connect', socket => this.prepareNewClient(socket));
    return this;
  }

  /**
   * Subscribe all connections for particular client to messages from
   * given rooms.
   */
  setRooms(user: string, rooms: string[]) {
    Object.values(this.chat.sockets)
      .filter(socket => socket.request.user === user)
      .forEach(client => rooms.forEach(room => client.join(room)));
  }

  /**
   * Return current chat instance(Namespace). Unlikely you'll ever
   * need this.
   */
  getServer() {
    return this.chat;
  }

  /**
   * List existing rooms(either all or only listed inside `rooms`)
   * with the names(socket.request.user) of subscribers.
   */
  listMembers(rooms: string[]): { [key: string]: string[] } {
    let result = Object.entries(this.chat.adapter.rooms);
    if (rooms) {
      const roomSet = new Set(rooms);
      result = result.filter(([key]) => roomSet.has(key));
    }

    return Object.assign(
      {},
      ...result.map(([key, room]) => ({
        [key]: Array.from(new Set(Object.keys(room.sockets).map(socketId => this.chat.sockets[socketId].request.user))),
      })),
    );
  }
}
