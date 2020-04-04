const app = require('express')()
const server = require('http').Server(app)
const uuidv4 = require('uuid').v4
const io = require('socket.io')(server)
const faker = require('faker')
const cors = require('cors')
const Rooms = require('./Rooms')
const Users = require('./Users')
const helpers = require('./helpers')
const logInfo = require('./dashboard')

const nolog = process.env.NOLOG
if (!nolog) {
  logInfo.start()
}

app.use(cors())

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
  const room = Rooms.get(req.params.rid)
  if (room) {
    const payload = Rooms.roomToSerializable(room)
    res.send(payload)
  } else {
    res.status(404)
    res.end()
  }
})

const createRoom = ({ socket, io }) => ({ name, id, privateRoom }) => {
  if (helpers.validateUUID(id)) {
    Users.set({ socket, id, name })
    const rid = uuidv4()
    const roomName = faker.hacker.noun()
    Rooms.set(rid, {
      id: rid,
      host: id,
      name: roomName,
      privateRoom,
      players: [
        {
          socket,
          id,
          name,
        },
      ],
    })
    console.log(`Create room ${rid}`)
    socket.join(rid)
    socket.emit('created-room', rid)
    userChanged({ rid, io })
    logInfo.createRoom({ sid: socket.id, rid })
  }
}

const enterRoom = ({ socket, io }) => ({ rid, id, name }) => {
  if (helpers.validateUUID(id)) {
    Users.set({ socket, id, name })
    const room = Rooms.get(rid)
    if (room) {
      Rooms.addPlayer(room, { socket, id, name })
      socket.join(rid)
      logInfo.createRoom({ rid, sid: socket.id })
    }
    userChanged({ rid, io })
  }
}

const leaveRoom = ({ socket, io }) => ({ name, id, rid }) => {
  if (helpers.validateUUID(id)) {
    const room = Rooms.get(rid)
    const player = Rooms.getPlayer(room, id)
    if (room && player) {
      if (room.host === id) {
        Rooms.unset(rid)
      }
      console.log('leave to room', rid)
      socket.leave(rid)
      userChanged({ rid, io })
      logInfo.leaveRoom({ rid, sid: socket.id })
    }
  }
}

const userChanged = ({ rid, io }) => {
  const room = Rooms.get(rid)
  if (room) {
    const { players } = Rooms.roomToSerializable(room)
    console.log(players)
    io.to(rid).emit('users', players)
  }
}

const broadcastAction = ({ id, rid, action }) => {
  if (helpers.validateUUID(id)) {
    const room = Rooms.get(rid)
    const player = Rooms.getPlayer(room, id)
    if (room && player) {
      const host = Rooms.getPlayer(room, room.host)
      if (host) {
        host.socket.emit('action', { id, action })
      }
    }
  }
}

const broadcastState = ({ id, to, rid, state }) => {
  if (helpers.validateUUID(id)) {
    const room = Rooms.get(rid)
    const host = Rooms.getPlayer(room, id)
    if (room && host && room.host === id) {
      if (state === 'start') {
        const sids = Object.keys(io.in(rid).connected)
        logInfo.startGame({ rid, sids })
      }
      if (state === 'end') {
        const sids = Object.keys(io.in(rid).connected)
        logInfo.endGame({ rid, sids })
      }
      if (to) {
        const receiver = Rooms.getPlayer(room, to)
        receiver.socket.emit('state', { state })
      } else {
        io.to(rid).emit('state', { state })
      }
    }
  }
}

io.on('connection', socket => {
  logInfo.socketConnect({ sid: socket.id })
  socket.on('enter-room', enterRoom({ socket, io }))
  socket.on('create-room', createRoom({ socket, io }))
  socket.on('leave-room', leaveRoom({ socket, io }))
  socket.on('action', broadcastAction)
  socket.on('dashboard', logInfo.sendDataToDashboard({ socket }))
  socket.on('disconnect', () => logInfo.socketDisconnect({ sid: socket.id }))
  socket.on('state', broadcastState)
})

const port = process.env.PORT || 3030

server.listen(port, () => {
  console.log(`Listening on ${port}`)
})
