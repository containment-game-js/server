const users = {}

const set = ({ socket, id, name, rooms }) => {
  users[id] = { name, socket, rooms }
  return name
}

const append = ({ socket, id, name, rooms }) => {
  const user = users[id] || { rooms: [] }
  users[id] = { ...user, socket, name, rooms: [...user.rooms, ...rooms] }
  return name
}

const findBy = ({ socket }) => {
  const result = Object.entries(users).find(([_id, user_]) => {
    return user_.socket.id === socket.id
  })
  if (result) {
    const [id, user] = result
    return { ...user, id }
  }
}

const removeFromRoom = ({ id, rid }) => {
  const user = users[id]
  if (user) {
    const rooms = user.rooms || []
    user.rooms = rooms.filter(roomId => roomId !== rid)
    return rid
  } else {
    return null
  }
}

const get = id => users[id]

const addCanceller = (uid, canceller) => {
  const user = users[uid]
  user.canceller = canceller
  return user
}

const removeCanceller = id => {
  const user = users[id]
  clearTimeout(user.canceller)
  delete user.canceller
  return user
}

module.exports = {
  append,
  set,
  get,
  findBy,
  removeFromRoom,
  addCanceller,
  removeCanceller,
}
