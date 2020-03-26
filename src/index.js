const app = require('express')()
const server = require('http').Server(app)
const p2p = require('socket.io-p2p-server').Server
const uuidv4 = require('uuid').v4
const io = require('socket.io')(server)
const faker = require('faker')

app.get('/', function (req, res) {
  res.send(roomsToString())
})
io.use(p2p)

const rooms = {}
const names = {}

const setName = ({ socket, name }) => {
  names[socket.id] = name
}

const getName = ({ socket }) => names[socket.id]

const roomsToString = () =>
  JSON.stringify(
    Object.values(rooms).map((room) => ({
      ...room,
      host: room.host.id,
      players: room.players.map((player) => ({ name: player.name })),
    }))
  )

const createRoom = ({ socket, io }) => (name) => {
  try {
    setName({ socket, name })
    const rid = uuidv4()
    const roomName = faker.hacker.noun()
    rooms[rid] = {
      id: rid,
      host: socket,
      name: roomName,
      players: [
        {
          socket,
          name,
        },
      ],
    }
    console.log(`Create room ${rid}`)
    socket.join(rid)
    socket.emit('create-room', rid)
    io.to(rid).emit('go-private')

    userChanged({ rid, io })
    dispatchRooms(io)
  } catch (e) {
    console.error(e)
  }
}

const enterRoom = ({ socket, io }) => ({ rid, name }) => {
  try {
    setName({ socket, name })
    if (!rooms[rid].players.find((p) => p.socket === socket)) {
      rooms[rid].players.push({ socket, name })
      socket.join(rid)
      console.log('emit to room', rid)
      io.to(rid).emit('go-private')

      userChanged({ rid, io })
      dispatchRooms(io)
    }
  } catch (e) {
    console.error(e)
  }
}

const leaveRoom = ({ socket, io }) => ({ name, rid }) => {
  try {
    if (rid) {
      if (rooms[rid] && rooms[rid].players.find((p) => p.socket === socket)) {
        rooms[rid].players = rooms[rid].players.filter(
          (p) => p.socket !== socket
        )
        if (rooms[rid].host === socket) {
          delete rooms[rid]
        }
        console.log('leave to room', rid)
        socket.leave(rid)
        dispatchRooms(io)
        userChanged({ rid, io })
      }
    } else {
      let changed = false
      Object.values(rooms).forEach((room) => {
        if (room.players.find((p) => p.socket === socket)) {
          changed = true
          room.players = room.players.filter((p) => p.socket !== socket)
          if (room.host === socket) {
            console.log('leave to room', getName({ socket }), room.id)
            socket.leave(room.id)
            delete rooms[room.id]
            userChanged({ rid: room.id, io })
          }
        }
      })
      if (changed) {
        userChanged({ rid, io })
        dispatchRooms(io)
      }
    }
  } catch (e) {
    console.error(e)
  }
}

const userChanged = ({ rid, io }) => {
  if (rooms[rid]) {
    const users = rooms[rid].players.map((player) => ({
      ...player,
      socket: null,
      id: player.socket.id,
    }))
    console.log(users)
    io.to(rid).emit('users', users)
  }
}

const dispatchRooms = (socket) =>
  socket.emit(
    'rooms',
    Object.values(rooms).map((room) => ({
      ...room,
      host: room.host.id,
      players: room.players.map((player) => ({ name: player.name })),
    }))
  )

// const playersChanged = ({rid, io}) => {
//   if (rooms[rid]) {
//     io.emit()
//   }
// }

io.on('connection', function (socket) {
  dispatchRooms(socket)

  socket.on('action', console.log)

  socket.on('enter-room', enterRoom({ socket, io }))

  socket.on('create-room', createRoom({ socket, io }))

  socket.on('leave-room', leaveRoom({ socket, io }))

  socket.on('get-rooms', () => dispatchRooms(socket))

  socket.on('disconnect', leaveRoom({ socket, io }))

  // socket.on('peer-msg', function(data) {
  //   console.log('Message from peer: %s', data);
  //   socket.broadcast.emit('peer-msg', data);
  // })
  //
  socket.on('go-private', function (data) {
    console.log('private')
    socket.broadcast.emit('go-private', data)
  })
})

server.listen(process.env.PORT, function () {
  console.log(`Listening on ${process.env.PORT}`)
})
