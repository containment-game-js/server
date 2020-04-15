const { PubSub } = require('@google-cloud/pubsub')

const pubsub = new PubSub()

const topicName = process.env.LOGS_TOPIC_NAME || 'logs-test'

const publish = async (type, payload) => {
  const version = '1.0.0'
  const timestamp = Date.now()
  const data = JSON.stringify({ version, type, timestamp, payload })
  const dataBuffer = Buffer.from(data)
  const messageId = await pubsub.topic(topicName).publish(dataBuffer)
  console.log(`Message ${messageId} published.`)
}

module.exports = {
  publish,
}
