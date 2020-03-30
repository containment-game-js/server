const users = {}

const set = ({ socket, id, name }) => {
  users[id] = { name, socket }
  return name
}

const get = id => users[id]

module.exports = {
  set,
  get,
}
