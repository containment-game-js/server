const os = require('os')
const { toSerializable } = require('./Rooms')
const ram = []
const rooms = []
const sockets = []
const occupation = {
  idle: [],
  preparation: [],
  inGame: [],
}

let interval
const INTERVAL = 60000

const start = () => {
  getStats()
  interval = setInterval(saveRam, INTERVAL)
}
const stop = () => clearInterval(interval)

const getStats = () => ({
  ram,
  rooms,
  sockets,
  occupation,
  roomInfo: toSerializable(),
})

const getRam = () => (os.totalmem() - os.freemem()) / 1024 / 1024 / 1024

const saveRam = () => ram.push([Date.now(), getRam()])

const createRoom = ({ rid, sid }) => {
  const now = Date.now()
  rooms.push({ rid, createdAt: now, updatedAt: now })
  joinRoom({ sid })
}

const joinRoom = ({ sid }) => {
  occupation.idle = occupation.idle.filter(id => id !== sid)
  occupation.preparation.push(sid)
}

const leaveRoom = ({ sid, rid }) => {
  updateRoom({ rid })
  socketUpdate({ sid })
  occupation.inGame = occupation.inGame.filter(id => id !== sid)
  occupation.preparation = occupation.preparation.filter(id => id !== sid)
  occupation.idle.push(sid)
}

const socketConnect = ({ sid }) => {
  const now = Date.now()
  sockets.push({ sid, createdAt: now, updatedAt: now })
  occupation.idle.push(sid)
}

const socketDisconnect = ({ sid }) => {
  socketUpdate({ sid })
  occupation.inGame = occupation.inGame.filter(id => id !== sid)
  occupation.preparation = occupation.preparation.filter(id => id !== sid)
  occupation.idle = occupation.idle.filter(id => id !== sid)
}

const socketUpdate = ({ sid }) => {
  const socket = sockets.find(s => s.sid === sid)
  if (socket) socket.updatedAt = Date.now()
}

const updateRoom = ({ rid }) => {
  const room = rooms.find(r => r.rid === rid)
  if (room) room.updatedAt = Date.now()
}

const startGame = ({ rid, sids }) => {
  occupation.preparation = occupation.preparation.filter(id =>
    sids.includes(id)
  )
  occupation.inGame = occupation.inGame.concat(sids)
  updateRoom({ rid })
}

const endGame = ({ rid, sids }) => {
  occupation.inGame = occupation.inGame.filter(id => sids.includes(id))
  occupation.preparation = occupation.preparation.concat(sids)
  updateRoom({ rid })
}

const sendDataToDashboard = ({ socket, io }) => () => {
  const interval = setInterval(() => {
    socket.emit('info', getStats())
  }, 1000)
  socket.on('disconnect', () => clearInterval(interval))
}

module.exports = {
  sendDataToDashboard,
  socketDisconnect,
  socketConnect,
  socketUpdate,
  createRoom,
  updateRoom,
  leaveRoom,
  startGame,
  joinRoom,
  getStats,
  saveRam,
  endGame,
  start,
  stop,
}
