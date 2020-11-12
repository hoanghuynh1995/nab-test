const uuid = require('uuid')

const authUtils = require('../utils/auth')
const storageService = require('../services/google-cloud-storage')
const queueService = require('../services/amqp')
const queueConstant = require('../constants/queue')

exports.login = async (query, password, collection, type) => {
  const user = await collection.findOne(query).lean()
  if (!user) {
    const err = new Error('Incorrect Username or Password')
    throw err
  }
  // compare password hash
  const valid = await authUtils.compareHash(password, user.password)
  if (!valid) {
    const err = new Error('Incorrect Username or Password')
    throw err
  }
  delete user.password
  // generate token
  const token = await authUtils.generateToken(user, type)
  return {
    ...user,
    token
  } 
}

/**
 * data: user info
 * userType: person | businessPerson
 */
exports.createUser = async (data) => {
  const token = uuid.v1()
  data.token = token
  // hashing password
  data.password = await authUtils.generateHash(data.password)

  let res
  try {
    res = await data.save()
  } catch (err) {
    throw err
  }
  if (!res) {
    const err = new Error('Internal Server Error')
    throw err
  }
  delete res.password
  return res
}

exports.checkToken = async (token, type) => {
  return await authUtils.verifyToken(token, type)
}

exports.sendOrderMessage = order => {
  return queueService.sendMessage({
    queueName: queueConstant.ORDER_QUEUE_NAME,
    messageData: order,
  })
}