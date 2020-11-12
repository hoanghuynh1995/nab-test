const db = require('../../db')
const statusConstants = require('../../constants/status')
const helper = require('../../services/helper')
const reportService = require('../../services/report')

exports.createStore = async (req, res, next) => {
  const {
    name,
    image,
    address,
    zipCode,
    tax = 0,
    shippingFee = 0,
    pickupFee = 0,
  } = req.body
  const {
    user,
  } = req.state
  if (!name) return res.error('name is required', 400)
  if (!image) return res.error('image is required', 400)
  if (!address) return res.error('address is required', 400)
  if (!zipCode) return res.error('zipCode is required', 400)

  // check if image exists
  let file
  try {
    file = await db.File.findById(image)
  } catch (err) {
    return res.error(err.message, 500)
  }
  if (!file) return res.error('image not found', 404)
  file.status = statusConstants.FILE.USED
  file.save()

  // create store
  let store
  try {
    store = await db.Store.create({
      name,
      image: file.url,
      address,
      zipCode,
      tax,
      shippingFee,
      pickupFee,
      businessUserId: user._id,
    })
  } catch (err) {
    return res.error(err.message, 500)
  }
  res.success(store)
}
exports.createStoreAfterSignup = async (req, res, next) => {
  const { user } = req.state
  const {
    geo,
  } = req.body
  // create store
  let store
  try {
    store = await db.Store.create({
      name: user.storeName,
      type: user.storeType,
      address: user.address,
      loc: geo,
      zipCode: user.zipCode,
      businessUserId: user._id,
    })
  } catch (err) {
    return res.error(err.message, 500)
  }
  res.send('Email is verified successfully!')
}

exports.getStores = async (req, res) => {
  const {
    user,
  } = req.state
  const {
    filter,
    page,
    limit,
  } = helper.getFilterAndPaging(req.query)
  let stores
  if (filter.zipCode) {
    try {
      stores = await db.Store.find(filter).skip(page * limit).limit(limit)
    } catch (err) {
      return res.error(err.message, 500)
    }
  } else {
    // search by both user zipcode and without zipcode
    const res = await Promise.all([
      db.Store.find({ zipCode: user.zipCode }).skip(page * limit).limit(limit),
      db.Store.find({ zipCode: { $ne: user.zipCode } }).skip(page * limit).limit(limit)
    ])
    stores = res[0].concat(res[1])
  }
  res.success(stores)
}

exports.getStoreProducts = async (req, res) => {
  const { storeId } = req.params
  let {
    filter,
    page = 0,
    limit = 50,
    sort
  } = req.query
  if (filter) {
    try {
      filter = JSON.parse(filter)
    } catch (err) {
      return res.error('Invalid filter')
    }
  } else {
    filter = {}
  }
  if (sort) {
    try {
      sort = JSON.parse(sort)
    } catch (err) {
      return res.error('Invalid sort')
    }
    for (let key in sort) {
      sort[key] = Number(sort[key])
    }
  } else {
    sort = {}
  }
  let products
  try {
    products = await db.Product.find({
      ...filter,
      store: storeId
    }).sort(sort).skip(page * limit).limit(limit).populate('category')
  } catch (err) {
    return res.error(err.message)
  }
  res.success(products)
}

/**
 * check if store belongs to current owner
 */
exports.checkStoreOwner = async (req, res, next) => {
  const { id: storeId } = req.params
  const { user } = req.state
  let store
  try {
    store = await db.Store.findById(storeId).lean()
  } catch (err) {
    return res.error(err.message)
  }
  if (!store) return res.error('Store not found', 404)
  if (store.businessUserId.toString() !== user._id) {
    return res.error('Unauthorized', 401)
  }
  req.state.store = store
  next()
}

exports.uploadStoreImage = async (req, res) => {
  const {
    image,
  } = req.body
  const {
    store,
  } = req.state
  if (!image) return res.error('image is required', 400)
  // check if image exists
  let file
  try {
    file = await db.File.findById(image)
  } catch (err) {
    return res.error(err.message)
  }
  if (file) {
    // if image not exist, use body.image as product image
    file.status = statusConstants.FILE.USED
    file.save()
  }
  store.image = file.url
  let savedStore
  try {
    savedStore = await await db.Store.findOneAndUpdate(
      { _id: store._id, },
      { image: file.url },
      { new: true },
    )
  } catch (err) {
    return res.error(err.message)
  }
  res.success(savedStore)
}

exports.getReports = async (req, res) => {
  const {
    store,
  } = req.state
  const {
    type = 'day',
  } = req.body
  let reports
  try {
    reports = (await reportService.getReports({
      storeId: store._id.toString(),
      type
    })).data
  } catch (err) {
    return res.error(err.message)
  }
  res.success(reports)
}
