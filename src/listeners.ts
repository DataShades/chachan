import { IClientHooks, Listener } from './types';
import socket from 'socket.io';

const mustExist = (socket: socket.Socket, value: any, key: string): boolean => {
  if (value) {
    return true;
  }
  socket.emit('error', `<${key}> must be specified`);
  return false;
};
const userLogin: Listener = (socket, user) => (socket.request.user = user);
const userLogout: Listener = socket => (socket.request.user = undefined);

const roomList: Listener = socket => Object.keys(socket.rooms);
const roomGet: Listener = (_socket, data) => data;
const roomCreate: Listener = (socket, { room }) => {
  mustExist(socket, room, 'room') && socket.join(room);
};

const roomVisit: Listener = (socket, { room }) => {
  if (!mustExist(socket, room, 'room')) {
    return;
  }
  socket.broadcast.to(room).emit('room:visited', { room, user: socket.request.user });
};
const roomJoin: Listener = (socket, { room }) => {
  if (!mustExist(socket, room, 'room')) {
    return;
  }
  socket.join(room);
  socket.broadcast.to(room).emit('room:joined', { room, user: socket.request.user });
};
const makeRoomInvite = (clients: socket.Socket[]): Listener => (socket, { room, user }) => {
  if (!mustExist(socket, user, 'user') || !mustExist(socket, room, 'room')) {
    return;
  }
  const client = clients.filter(s => user === s.request.user);
  if (!client.length) {
    return;
  }
  client.forEach(c => c.join(room));
  socket.broadcast.to(room).emit('room:invited', { room, user, by: socket.request.user });
};

const message: Listener = (client, data) => {
  client.broadcast.send(`[${client.request.user}] ${data}`);
};

export const listen = (client: socket.Socket, hooks: IClientHooks, nsp: socket.Namespace): void => {
  const listeners: [keyof IClientHooks, string, Listener][] = [
    ['userLogin', 'user:login', userLogin],
    ['userLogout', 'user:logout', userLogout],
    ['roomList', 'room:list:get', roomList],
    ['roomGet', 'room:details:get', roomGet],
    ['roomVisit', 'room:visit', roomVisit],
    ['roomCreate', 'room:create', roomCreate],
    ['roomJoin', 'room:join', roomJoin],
    ['roomInvite', 'room:invite', makeRoomInvite(Object.values(nsp.sockets))],
    ['message', 'message', message],
  ];

  listeners.forEach(([prop, event, handler]) => {
    const [before, after] = hooks[prop] || (Array(2) as void[]);
    client.on(event, async (data: any, cb?: CallableFunction) => {
      if (before) {
        data = await before(client, data);
      }
      let result = await handler(client, data);
      if (after) {
        result = await after(client, result);
      }
      if (cb) {
        cb(result);
      }
    });
  });
};
