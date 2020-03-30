const app = require('express')()
const server = require('http').Server(app)
const p2p = require('socket.io-p2p-server').Server
const uuidv4 = require('uuid').v4
const io = require('socket.io')(server)
const faker = require('faker')
const cors = require('cors')
const Rooms = require('./Rooms')
const Users = require('./Users')

app.use(cors())
io.use(p2p)

const upDate = new Date().toString()

app.get('/', (req, res) => {
  const numberOfRooms = Rooms.length()
  const rooms = Rooms.toSerializable()
  res.send({ numberOfRooms, upDate, rooms })
})

app.get('/get-rooms', (req, res) => {
  const rooms = Rooms.toSerializable()
  res.send(rooms)
})

app.get('/get-room-info/:rid', (req, res) => {
  const room = Rooms.get(req.url.params.rid)
  if (room) {
    const payload = Rooms.roomToSerializable(room)
    res.send(payload)
  } else {
    res.setStatus(4040)
    res.end()
  }
})

const createRoom = ({ socket, io }) => ({ name, id, privateRoom }) => {
  Users.set({ socket, id, name })
  const rid = uuidv4()
  const roomName = faker.hacker.noun()
  Rooms.set(rid, {
    id: rid,
    host: id,
    name: roomName,
    privateRoom,
    players: [{ socket, id, name }],
  })
  console.log(`Create room ${rid}`)
  socket.join(rid)
  socket.emit('created-room', rid)
  io.to(rid).emit('go-private')
  userChanged({ rid, io })
}

const enterRoom = ({ socket, io }) => ({ rid, id, name }) => {
  Users.set({ socket, id, name })
  const room = Rooms.get(rid)
  if (room) {
    const user = Rooms.getPlayer(room, id)
    if (user) {
      user.socket = socket
    } else {
      Rooms.addPlayer(room, { socket, id, name })
      socket.join(rid)
      io.to(rid).emit('go-private')
    }
    userChanged({ rid, io })
  }
}

const leaveRoom = ({ socket, io }) => ({ name, id, rid }) => {
  const room = Rooms.get(rid)
  const player = Rooms.getPlayer(room, id)
  if (room && player) {
    if (room.host === id) {
      Rooms.unset(rid)
    }
    console.log('leave to room', rid)
    socket.leave(rid)
    userChanged({ rid, io })
  }
}

const userChanged = ({ rid, io }) => {
  const room = Rooms.get(rid)
  if (room) {
    const serialize = player => ({ ...player, socket: null })
    const users = room.players.map(serialize)
    console.log(users)
    io.to(rid).emit('users', users)
  }
}

io.on('connection', socket => {
  socket.emit('user-id', uuidv4())
  socket.on('enter-room', enterRoom({ socket, io }))
  socket.on('create-room', createRoom({ socket, io }))
  socket.on('leave-room', leaveRoom({ socket, io }))
})

const port = process.env.PORT || 3030

server.listen(port, () => {
  console.log(`Listening on ${port}`)
})
