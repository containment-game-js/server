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
    const rid = uuidv4()
    Users.append({ socket, id, name, rooms: [rid] })
    const roomName = faker.hacker.noun()
    const players = [{ socket, id, name }]
    Rooms.set(rid, {
      id: rid,
      host: id,
      name: roomName,
      privateRoom,
      players,
    })
    socket.join(rid)
    socket.emit('created-room', rid)
    userChanged({ rid, io })
    logInfo.createRoom({ sid: socket.id, rid })
  }
}

const enterRoom = ({ socket, io }) => ({ rid, id, name }) => {
  if (helpers.validateUUID(id)) {
    Users.append({ socket, id, name, rooms: [rid] })
    Users.removeCanceller(id)
    const room = Rooms.get(rid)
    if (room) {
      Rooms.addPlayer(room, { socket, id, name })
      socket.join(rid)
      logInfo.createRoom({ rid, sid: socket.id })
    }
    userChanged({ rid, io })
  }
}

const leaveRoom = ({ socket, io }) => ({ id, rid }) => {
  if (helpers.validateUUID(id)) {
    const room = Rooms.get(rid)
    const player = Rooms.getPlayer(room, id)
    if (room && player) {
      Rooms.removePlayer(room, player)
      Users.removeFromRoom(id, rid)
      if (room.host === id) {
        Rooms.newHost(room)
      }
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

const kick = ({ socket, io }) => ({ id, rid, kid }) => {
  if (helpers.validateUUID(id)) {
    const room = Rooms.get(rid)
    if (room.host === id) {
      const user = Rooms.getPlayer(room, kid)
      if (user) {
        leaveRoom({ socket: user.socket, io })({ id: user.id, rid })
        socket.emit('kicked-user', { id: user.id })
        user.socket.emit('kicked')
      }
    }
  }
}

const closeRoom = ({ socket, io }) => ({ id, rid }) => {
  if (helpers.validateUUID(id)) {
    const room = Rooms.get(rid)
    if (room.host === id) {
      room.players.forEach(({ socket, id }) => {
        leaveRoom({ socket, io })({ rid, id })
        socket.emit('kicked')
      })
      socket.emit('closed-room')
    }
  }
}

const disconnectUser = ({ socket, io }) => () => {
  logInfo.socketDisconnect({ sid: socket.id })
  const user = Users.findBy({ socket })
  if (user) {
    const fiveMinutes = 300000
    const canceller = setTimeout(() => {
      user.rooms.forEach(rid => {
        leaveRoom({ socket, io })({ id: user.id, rid })
      })
    }, fiveMinutes)
    Users.addCanceller(user.id, canceller)
  }
}

io.on('connection', socket => {
  logInfo.socketConnect({ sid: socket.id })
  socket.on('enter-room', enterRoom({ socket, io }))
  socket.on('create-room', createRoom({ socket, io }))
  socket.on('close-room', closeRoom({ socket, io }))
  socket.on('leave-room', leaveRoom({ socket, io }))
  socket.on('action', broadcastAction)
  socket.on('dashboard', logInfo.sendDataToDashboard({ socket }))
  socket.on('kick', kick({ socket, io }))
  socket.on('disconnect', disconnectUser({ socket, io }))
  socket.on('state', broadcastState)
})

const port = process.env.PORT || 3030

server.listen(port, () => {
  console.log(`Listening on ${port}`)
})
