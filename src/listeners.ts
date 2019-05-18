import { IClientHooks, Listener, BeforeAfterHooks, Hooks } from './types';
import socket from 'socket.io';
import { StopException } from './exceptions';
import debug from 'debug';

const log = debug('chachan:listeners');
const logError = log.extend('error');
const logDebug = log.extend('debug');

const mustExist = (socket: socket.Socket, value: any, key: string): boolean => {
  if (value) {
    return true;
  }
  socket.emit('error:validation', { error: `<${key}> must be specified` });
  return false;
};

const userLogin: Listener = (socket, { user }) => {
  if (!mustExist(socket, user, 'user')) {
    return { user };
  }
  socket.request.user = user;
  return { user };
};
const userLogout: Listener = socket => {
  const { user } = socket.request;
  socket.request.user = undefined;
  return user;
};

const roomList: Listener = socket => Object.keys(socket.rooms).filter(room => !room.endsWith(socket.id));
const roomDetails: Listener = (_socket, data) => data;
const roomCreate: Listener = (socket, { room }) => {
  if (!mustExist(socket, room, 'room')) {
    return { room };
  }
  const user = socket.request.user;
  const client = Object.values(socket.nsp.sockets).filter(s => user === s.request.user);
  client.forEach(c => c.join(room));
  const data = { user, room };
  socket.broadcast.to(room).emit('room:joined', data);
  return data;
};

const roomVisit: Listener = (socket, { room }) => {
  if (!mustExist(socket, room, 'room')) {
    return { room };
  }
  const data = { room, user: socket.request.user };
  socket.broadcast.to(room).emit('room:visited', data);
  return data;
};
const roomJoin: Listener = (socket, { room }) => {
  if (!mustExist(socket, room, 'room')) {
    return { room };
  }
  const client = Object.values(socket.nsp.sockets).filter(s => socket.request.user === s.request.user);
  client.forEach(c => c.join(room));
  const data = { room, user: socket.request.user };
  socket.broadcast.to(room).emit('room:joined', data);
  return data;
};
const roomLeave: Listener = (socket, { room }) => {
  if (!mustExist(socket, room, 'room')) {
    return { room };
  }
  const client = Object.values(socket.nsp.sockets).filter(s => socket.request.user === s.request.user);
  client.forEach(c => c.leave(room));
  const data = { room, user: socket.request.user };
  socket.broadcast.to(room).emit('room:joined', data);
  return data;
};

const roomInvite: Listener = (socket, { room, user }) => {
  if (!mustExist(socket, user, 'user') || !mustExist(socket, room, 'room')) {
    return { room, user };
  }
  const client = Object.values(socket.nsp.sockets).filter(s => user === s.request.user);
  if (!client.length) {
    return { room, user };
  }
  client.forEach(c => c.join(room));
  const data = { room, user, by: socket.request.user };
  socket.broadcast.to(room).emit('room:invited', data);
  return data;
};
const roomExpell: Listener = (socket, { room, user }) => {
  if (!mustExist(socket, user, 'user') || !mustExist(socket, room, 'room')) {
    return { room, user };
  }
  const client = Object.values(socket.nsp.sockets).filter(s => user === s.request.user);
  if (!client.length) {
    return { room, user };
  }
  client.forEach(c => c.leave(room));
  const data = { room, user, by: socket.request.user };
  socket.broadcast.to(room).emit('room:invited', data);
  return data;
};

const message: Listener = (client, data) => {
  if (!mustExist(client, data.room, 'room')) {
    return data;
  }

  client.broadcast.to(data.room).send(data);
  return data;
};

const _second = (_: any, result: any) => result;

export const listenWithHooks = (client: socket.Socket, hooks: Hooks, hookedEvents: string[]): void => {
  for (let i = 0; i < hookedEvents.length; ++i) {
    const eventName = hookedEvents[i];
    const normalizedName = eventName
      .split(':')
      .map((word, idx) => (idx ? word[0].toUpperCase() + word.slice(1) : word))
      .join('');

    const { before = _second, on = _second, after = _second } = hooks[normalizedName] || ({} as Hooks);
    client.on(eventName, async (data: any = {}, cb: CallableFunction) => {
      logDebug(`<${eventName}> emitted.`);
      try {
        data = await before(client, data);
      } catch (e) {
        if (e instanceof StopException) {
          logDebug(`<${eventName}> had been stopped in before phase.`);
          return;
        }
        logError(`ERROR: event: ${eventName}, hook: before`, e);
        throw e;
      }

      let result;
      try {
        result = await on(client, data);
      } catch (e) {
        logError(`ERROR: event: ${eventName}, hook: on`, e);
        throw e;
      }

      try {
        result = await after(client, result);
      } catch (e) {
        logError(`ERROR: event: ${eventName}, hook: after`, e);
        throw e;
      }

      cb && cb(result);
    });
  }
};

export const nativeHooks = {
  userLogin,
  userLogout,
  roomList,
  roomDetails,
  roomVisit,
  roomCreate,
  roomJoin,
  roomLeave,
  roomInvite,
  roomExpell,
  message,
};

export const listen = (client: socket.Socket, hooks: IClientHooks): void => {
  const listeners: [keyof IClientHooks, string, Listener][] = [
    ['userLogin', 'user:login', userLogin],
    ['userLogout', 'user:logout', userLogout],
    ['roomList', 'room:list', roomList],
    ['roomDetails', 'room:details', roomDetails],
    ['roomVisit', 'room:visit', roomVisit],
    ['roomCreate', 'room:create', roomCreate],
    ['roomJoin', 'room:join', roomJoin],
    ['roomLeave', 'room:leave', roomLeave],
    ['roomInvite', 'room:invite', roomInvite],
    ['roomExpell', 'room:expell', roomExpell],
    ['message', 'message', message],
  ];

  listeners.forEach(([prop, event, handler]) => {
    const { before, after } = hooks[prop] || ({} as BeforeAfterHooks<Listener>);
    client.on(event, async (data: any = {}, cb: CallableFunction) => {
      if (before) {
        try {
          data = await before(client, data);
        } catch (e) {
          if (e instanceof StopException) {
            return;
          }
          logError(`ERROR: event: ${event}, hook: before`, e);
          throw e;
        }
      }
      let result;
      try {
        result = await handler(client, data);
      } catch (e) {
        logError(`ERROR: event: ${event}, handler`, e);
        throw e;
      }

      log(event, data, result);
      if (after) {
        try {
          result = await after(client, result);
        } catch (e) {
          logError(`ERROR: event: ${event}, hook: after`, e);
          throw e;
        }
      }
      cb && cb(result);
    });
  });
};
