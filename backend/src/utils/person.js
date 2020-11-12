const statusConstant = require('../constants/status')

const person = ({
  firstName,
  lastName,
  phone,
  zipCode,
  email,
  password,
  token,
}) => ({
  firstName,
  lastName,
  phone,
  zipCode,
  email,
  password,
  token,
})

const businessPerson = data => ({
  firstName: data.firstName,
  lastName: data.lastName,
  username: data.username,
  email: data.email,
  phoneNumber: data.phoneNumber,
  address: data.address,
  storeName: data.storeName,
  storeType: data.storeType,
  password: data.password,
  token: data.token,
  status: data.status || statusConstant.BUSINESS_USER.STATUS.PENDING,
})

module.exports = { person, businessPerson }