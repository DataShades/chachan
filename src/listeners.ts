import { IClientHooks, Listener, BeforeAfterHooks } from './types';
import socket from 'socket.io';
import { StopException } from './exceptions';

const mustExist = (socket: socket.Socket, value: any, key: string): boolean => {
  if (value) {
    return true;
  }
  socket.emit('error:validation', { error: `<${key}> must be specified` });
  return false;
};
const userLogin: Listener = (socket, { user }) => {
  if (!mustExist(socket, user, 'user')) {
    return;
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
  mustExist(socket, room, 'room') && socket.join(room);
  return { room };
};

const roomVisit: Listener = (socket, { room }) => {
  if (!mustExist(socket, room, 'room')) {
    return;
  }
  const data = { room, user: socket.request.user };
  socket.broadcast.to(room).emit('room:visited', data);
  return data;
};
const roomJoin: Listener = (socket, { room }) => {
  if (!mustExist(socket, room, 'room')) {
    return;
  }
  const client = Object.values(socket.nsp.sockets).filter(s => socket.request.user === s.request.user);
  client.forEach(c => c.join(room));
  const data = { room, user: socket.request.user };
  socket.broadcast.to(room).emit('room:joined', data);
  return data;
};
const roomInvite: Listener = (socket, { room, user }) => {
  if (!mustExist(socket, user, 'user') || !mustExist(socket, room, 'room')) {
    return;
  }
  const client = Object.values(socket.nsp.sockets).filter(s => user === s.request.user);
  if (!client.length) {
    return;
  }
  client.forEach(c => c.join(room));
  const data = { room, user, by: socket.request.user };
  socket.broadcast.to(room).emit('room:invited', data);
  return data;
};

const message: Listener = (client, data) => {
  if (!mustExist(client, data.room, 'room')) {
    return;
  }

  client.broadcast.to(data.room).send(data);
  return data;
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
    ['roomInvite', 'room:invite', roomInvite],
    ['message', 'message', message],
  ];

  listeners.forEach(([prop, event, handler]) => {
    const { before, after } = hooks[prop] || ({} as BeforeAfterHooks<Listener>);
    client.on(event, async (data: any, cb: CallableFunction) => {
      if (before) {
        try {
          data = await before(client, data);
        } catch (e) {
          if (e instanceof StopException) {
            return;
          }
          throw e;
        }
      }
      let result = await handler(client, data);
      if (after) {
        result = await after(client, result);
      }
      cb && cb(result);
    });
  });
};
