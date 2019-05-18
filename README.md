## Installation

``npm install chachan``

## Usage

1. Create an instance of chat(ex. `PersistentChatWithRooms`)
2. Set hooks for incomming client connections via ``::setClientHooks``
3. Add you custom listeners via ``::on``
4. Start server via ``::start``

## Hooks

chachan handles different incomming events via internal commands. In
order to make this process customizable, one can provide `hooks` for
command. For example, developer can prepare arguments, that passed
into handler with `before` hook and change output of handler with
`after` hook. All hooks are receiving two arguments: socket for client
connection and object with payload. Every hook have to return some
data that will replace/update original payload. In such manner,
anything that you return from `before` hook will completely replace
original input for event(because it receives original input as second
argument), and anything you return from `after` hook will replace
result of event handler(because it receives original result as second
argument).

For now, all handlers supports only `before` and `after` hooks. They
should be registered via:

    chatInstance.setClientHooks({handlerName: {before: beforeFunction, after: afterFunction}})

List of handlers and events that are triggering them:

* userLogin - user:login
* userLogout - user:logout
* roomList - room:list
* roomVisit - room:visit
* roomDetails - room:details
* roomCreate - room:create
* roomJoin - room:join
* roomLeave - room:leave
* roomInvite - room:invite
* roomExpell - room:expell
* message - message

## Client events

* error:validation - event emitted by user is missing some required param / param has incorrect value
* room:visited - room was just visited by user(received in response to room:visit)
* room:joined - user itself joined room(room:join)
* room:invited - user joined room after invitation (room:invite)

## Example
```js
import { PersistentChatWithRooms } from 'chachan';
const chat = new PersistentChatWithRooms(3000);
const Rooms = new Map<string, Set<string>>()
chat.setClientHooks({
  roomCreate: {before: (socket, data = {}) => {
    const {user} = socket.request;
    if (!user) {
      return data;
    }

    const {room} = data

    if (!Rooms.get(user)) {
      Rooms.set(user, new Set)
    }
    Rooms.get(user)!.add(room)
    return data;
  }},
  userLogin: {after: (_socket, {user}={}) => {
    chat.setRooms(user, Array.from(Rooms.get(user)||[]))
    return {user}
  }}

})
chat.start()
```

```html
<!doctype html>
<html lang="en">
    <head>
        <meta charset="UTF-8"/>
        <title>Document</title>
    </head>
    <body>
        <div id="chat">
            <fieldset>
                <legend>Rooms[<span id="activeRoomLabel"></span>]</legend>
                <input placeholder="Room" onchange="createRoom(this.value); this.value=''"/>
                <button onclick="resetRooms(); fetchRooms()">Reset</button>
                <ul id="rooms" onclick="switchRoom(event)">
                    <li>a</li>
                    <li>b</li>
                </ul>
            </fieldset>
            <input placeholder="Login" onchange="user=this.value; login(); this.value=''"/>
            <br/>
            <input placeholder="Message" onchange="sendMessage(this.value); this.value=''"/>
            <ul id="log"></ul>
        </div>
        <script src="http://localhost:3000/socket.io/socket.io.js"></script>
        <script>
         let chat, user, room;
         window.addEventListener('load', initChat);
         function switchRoom(event) {
             room = event.target.textContent;
             chat.emit('room:visit', {room})
             chat.emit('room:get', {room}, history => {
                 resetLog();
                 history.forEach(({message}) => logChatMessage(message));
             })
             activeRoomLabel.textContent = room;
         }
         function createRoom(room) {
             chat.emit('room:create', {room})
             addRoom(room);
         }

         function sendMessage(message) {
             chat.emit('message', {room, message})
         }

         function login() {
             chat.emit('user:login', {user})
         }
         function resetRooms() {
             document.getElementById('rooms').innerText = ''
         }
         function fetchRooms() {
             chat.emit('room:list', {}, rooms => rooms.forEach(addRoom));
         }

         function resetLog() {
             document.getElementById('log').innerText = ''
         }
         function addRoom(data) {
             const rooms = document.getElementById('rooms')
             const room = document.createElement('li');
             room.textContent = data;
             rooms.append(room);
         }

         function logChatMessage(data) {
             const log = document.getElementById('log')
             const msg = document.createElement('li');
             console.log(data)
             msg.textContent = data;
             log.prepend(msg);
         }
         function initChat() {
             chat = io('http://localhost:3000/chachan/chat', {query: {token: 123}});
             chat.on('message', ({room: to, message}) => to === room && logChatMessage(message));
             chat.on('error', console.error);
             chat.on('reconnect', login);
         }
        </script>
    </body>
</html>
```
