const rooms = {}

const all = () => {
  return Object.values(rooms)
}

const length = () => {
  return all().length
}

const roomToSerializable = room => {
  const host = room.host.id
  const players = room.players.map(({ name }) => ({ name }))
  return { ...room, host, players }
}

const toSerializable = () => {
  const privateRooms = all().filter(room => !room.privateRoom)
  return privateRooms.map(roomToSerializable)
}

const set = (rid, value) => {
  rooms[rid] = value
  return value
}

const unset = rid => {
  const value = rooms[rid]
  delete rooms[rid]
  return value
}

const get = rid => {
  return rooms[rid]
}

const forEach = callback => {
  all().forEach(callback)
}

const map = callback => {
  return all().map(callback)
}

const getPlayer = (room, id) => {
  if (room) {
    return room.players.find(player => player.id === id)
  } else {
    return null
  }
}

module.exports = {
  all,
  set,
  unset,
  forEach,
  map,
  get,
  length,
  toSerializable,
  roomToSerializable,
  getPlayer,
}
