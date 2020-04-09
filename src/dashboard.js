const os = require('os')
const osUtils = require('os-utils')
const { toSerializable } = require('./Rooms')
const ram = []
const cpu = []
const rooms = []
const sockets = []
const occupation = {
  idle: [],
  preparation: [],
  inGame: [],
}

let interval
let cpuInterval
const RAM_INTERVAL = 60000
const CPU_INTERVAL = 30000

const start = () => {
  getStats()
  interval = setInterval(saveRam, RAM_INTERVAL)
  cpuInterval = setInterval(saveCpu, CPU_INTERVAL)
  saveRam()
  saveCpu()
}

const stop = () => {
  clearInterval(interval)
  clearInterval(cpuInterval)
}

const getStats = () => ({
  cpu,
  ram,
  rooms,
  sockets,
  occupation,
  roomInfo: toSerializable(),
})

const getCpu = () => {
  return new Promise(resolve => {
    osUtils.cpuUsage(resolve)
  })
}

const saveCpu = async () => {
  const value = await getCpu()
  cpu.push([Date.now(), value])
}

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
  sockets.push({ sid, createdAt: now, updatedAt: now, connected: true })
  occupation.idle.push(sid)
}

const socketDisconnect = ({ sid }) => {
  socketUpdate({ sid })
  occupation.inGame = occupation.inGame.filter(id => id !== sid)
  occupation.preparation = occupation.preparation.filter(id => id !== sid)
  occupation.idle = occupation.idle.filter(id => id !== sid)
}

const socketUpdate = ({ sid, connected = true }) => {
  const socket = sockets.find(s => s.sid === sid)
  if (socket) {
    socket.updatedAt = Date.now()
    socket.connected = connected
  }
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
  }, 10000)
  socket.emit('info', getStats())
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
