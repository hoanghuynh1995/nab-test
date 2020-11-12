const db = require('../../db')
const helper = require('../../services/helper')
const stripeConstant = require('../../constants/stripe')
const reportService = require('../../services/report')
const statusConstants = require('../../constants/status')

exports.getStores = async (req, res, next) => {
  let {
    filter,
    page,
    limit,
    sort,
  } = helper.getFilterAndPaging(req.query)
  let stores
  try {
    stores = await db.Store.find({
      ...filter,
    }).populate({
      path: 'businessUserId',
      model: db.BusinessUser,
      select: 'firstName lastName phoneNumber'
    })
      .sort(sort).skip(page * limit).limit(limit).sort({
        _id: -1
      })
  } catch (err) {
    return res.error(err.message)
  }
  res.success(stores)
}

exports.getStore = async (req, res) => {
  let {
    id
  } = req.params
  let store
  try {
    store = await db.Store.findById(id).populate({
      path: 'businessUserId',
      model: db.BusinessUser,
      select: '-password',
    }).lean()
  } catch (err) {
    return res.error(err.message, 500)
  }
  if (!store) return res.error('Store not found', 404)
  store.ccFee = `${Math.round(stripeConstant.PERCENTAGE_FEE * 1000) / 10}% + ${stripeConstant.FIXED_FEE}$`
  res.success(store)
}

exports.getReport = async (req, res) => {
  let {
    id
  } = req.params
  let {
    type
  } = req.query
  let report
  try {
    report = (await reportService.getStore(id, type)).data
  } catch (err) {
    console.log('getStore_getReport', err)
  }
  res.success(report)
}

exports.updateStore = async (req, res) => {
  let {
    id
  } = req.params
  const data = req.body
  let store
  try {
    store = await db.Store.findById(id)
  } catch (err) {
    return res.error(err.message)
  }
  if (!store) return res.error('Store not found', 404)
  if (data.status) {
    if (!Object.values(statusConstants.STORE).includes(data.status)) return res.error('Invalid status', 400)
    store.status = data.status
  }
  if (data.fixedFee) {
    store.fixedFee = data.fixedFee
  }
  if (data.percentageFee) {
    store.percentageFee = data.percentageFee
  }
  if (data.isPartner !== undefined) {
    store.isPartner = data.isPartner
  }
  if (data.fixedPickupFee) {
    store.fixedPickupFee = data.fixedPickupFee
  }
  if (data.percentagePickupFee) {
    store.percentagePickupFee = data.percentagePickupFee
  }
  try {
    await store.save()
  } catch (err) {
    return res.error(err.message)
  }
  res.success(store)
}
