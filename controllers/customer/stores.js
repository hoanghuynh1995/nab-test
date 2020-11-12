const db = require('../../db')
const statusConstant = require('../../constants/status')
const { query } = require('express')

const MAX_SEARCH_DISTANCE = 48280.32 // 10 miles ~ 16.09344 km

exports.getStores = async (req, res) => {
  const {
    user,
  } = req.state
  let {
    filter,
    page = 0,
    limit = 20,
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
  const query = { status: statusConstant.STORE.APPROVED }
  let stores
  let zipCode
  if (filter.zipCode) {
    try {
      zipCode = await db.ZipCode.findOne({
        zipcode: filter.zipCode
      })
    } catch (err) {
      return res.error(err.message, 500)
    }
    if (!zipCode) {
      return res.error('The zipcode not found', 400)
    }
    query.loc = {
      '$near': {
        '$maxDistance': MAX_SEARCH_DISTANCE,
        '$geometry': {
          type: 'Point',
          coordinates: [zipCode.long, zipCode.lat]
        }
      }
    }
    stores = await db.Store.find(query).skip(page * limit).limit(limit).lean()
  }
  stores = await db.Store.find(query).skip(page * limit).limit(limit).lean()
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
      select: 'email phoneNumber',
    }).lean()
  } catch (err) {
    return res.error(err.message, 500)
  }
  if (!store) return res.error('Store not found', 404)
  if (store.status !== statusConstant.STORE.APPROVED) return res.error('Store is pending', 404)
  let categories
  try {
    categories = await db.Category.find({
      store: store._id
    }).lean()
  } catch (err) {
    return res.error(err.message, 500)
  }
  let subcategories
  try {
    subcategories = await db.Subcategory.find({
      store: store._id
    }).lean()
  } catch (err) {
    return res.error(err.message, 500)
  }
  res.success({
    ...store,
    categories,
    subcategories,
  })
}

exports.getStoreCategories = async (req, res) => {
  const { storeId } = req.params
  let categories
  try {
    categories = await db.Category.find({
      store: storeId,
    })
  } catch (err) {
    return res.error(err.message, 500)
  }
  res.success(categories)
}

exports.getStoreProducts = async (req, res) => {
  const { storeId } = req.params
  let {
    filter,
    page = 0,
    limit = 50,
    sort,
  } = req.query
  let query = {}
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
  if (filter.category) {
    query.category = filter.category
  }
  if (filter.subcategory) {
    query.subcategory = filter.subcategory
  }
  if (filter.name) {
    // remove others filter
    // filter.name = { $regex: new RegExp(`${filter.name.toLowerCase()}`, 'i') }
    query = { $text: { $search: `${filter.name.toLowerCase()}` } }
    sort = { score: { $meta: 'textScore' } }
  }
  let products, count
  const promises = [db.Product.find({
    ...query,
    store: storeId
  }, sort.score ? { score: { $meta: 'textScore' } } : undefined)
    .sort(sort)
    .skip(page * limit)
    .limit(Number(limit))
    .populate('category')
    .lean()]
  if (page == 0) {
    // return count for pagination
    promises.push(db.Product.count({
      ...query,
      store: storeId
    }))
  }
  try {
    [products, count] = await Promise.all(promises)
  } catch (err) {
    return res.error(err.message)
  }
  products = products.map(p => ({
    ...p,
    score: undefined,
  }))
  res.success({
    products,
    count,
  })
}
