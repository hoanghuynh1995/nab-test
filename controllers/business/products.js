const db = require('../../db')
const statusConstants = require('../../constants/status')
const productConstants = require('../../constants/product')
const helper = require('../../services/helper')
const store = require('../../constants/store')

exports.createProduct = async (req, res, next) => {
  const {
    name,
    price,
    image,
    category: categoryLabel,
    subcategory: subcategoryLabel,
    store: storeId,
    sku,
    unit,
    unitValue = 1,
    inventory = 0,
    status,
  } = req.body
  const {
    user,
  } = req.state
  if (!name) return res.error('name is required', 400)
  if (!price) return res.error('price is required', 400)
  if (!image) return res.error('image is required', 400)
  if (!categoryLabel) return res.error('category is required', 400)
  if (!storeId) return res.error('store is required', 400)

  // check if product exists
  try {
    const product = await db.Product.findOne({
      store: storeId,
      name,
    })
    if (product) return res.error('Product existed', 400)
  } catch (err) {
    return res.error(err.message, 500)
  }
  // check if category exists
  let category
  try {
    category = await db.Category.findOne({
      store: storeId,
      label: categoryLabel,
    }).lean()
    if (!category) {
      // create one
      category = await db.Category.create({
        store: storeId,
        label: categoryLabel,
      })
    }
  } catch (err) {
    return res.error(err.message, 500)
  }

  let subcategory
  if (subcategoryLabel) {
    // check if subcategory exists
    try {
      subcategory = await db.Subcategory.findOne({
        store: storeId,
        label: subcategoryLabel,
        category: category._id
      }).lean()
      if (!subcategory) {
        // create one
        subcategory = await db.Subcategory.create({
          store: storeId,
          label: subcategoryLabel,
          category: category._id
        })
      }
    } catch (err) {
      return res.error(err.message, 500)
    }
  }

  // check if store exists
  let store
  try {
    store = await db.Store.findById(storeId).lean()
  } catch (err) {
    return res.error(err.message, 500)
  }
  if (!store) return res.error('store not found', 404)

  // check if image exists
  let file
  try {
    file = await db.File.findById(image)
  } catch (err) {
    console.error(err)
  }
  if (file) {
    // if image not exist, use body.image as product image
    file.status = statusConstants.FILE.USED
    file.save()
  }

  // create product
  let product
  try {
    product = await db.Product.create({
      name,
      price,
      image: file ? file.url : image,
      category: category._id,
      subcategory: subcategory ? subcategory._id : undefined,
      store: storeId,
      sku,
      unit,
      unitValue,
      inventory,
      status: status !== undefined ? status : statusConstants.PRODUCT.IN_STOCK,
    })
  } catch (err) {
    return res.error(err.message, 500)
  }
  res.success(product)
}

/**
 * search products by keyword
 */
exports.searchProducts = async (req, res) => {
  const { keyword = '' } = req.body
  let products
  try {
    products = await db.AvailableProduct.find({
      name: { $regex: new RegExp(`${keyword.toLowerCase()}`, 'i') }
    }).populate({
      path: 'category',
      model: db.AvailableCategory,
    }).populate({
      path: 'subcategory',
      model: db.AvailableSubcategory,
    }).limit(10)
  } catch (err) {
    return res.error(err)
  }
  res.success(products)
}

exports.getProducts = async (req, res) => {
  const { user } = req.state
  let {
    filter,
    page,
    limit,
    sort,
  } = helper.getFilterAndPaging(req.query)
  if (filter.name) {
    filter.name = { $regex: new RegExp(`${filter.name.toLowerCase()}`, 'i') }
  }
  let store
  try {
    store = await db.Store.findOne({
      businessUserId: user._id,
    })
  } catch (err) {
    return res.error(err, 500)
  }
  if (!store) return res.error('Store not found', 404)
  let products
  try {
    products = await db.Product.find({
      store: store._id,
      ...filter,
    }).sort(sort).skip(page * limit).limit(limit).sort({
      _id: -1
    })
  } catch (err) {
    return res.error(err, 500)
  }
  res.success(products)
}

exports.checkOwner = async (req, res, next) => {
  const { user } = req.state
  const { id } = req.params
  try {
    req.state.product = await db.Product.findById(id)
      .populate('store')
  } catch (err) {
    return res.error(err.message, 500)
  }
  if (!req.state.product) return res.error('Product not found', 404)
  if (req.state.product.store.businessUserId.toString() !== user._id) return res.error('Unauthorized', 401)
  next()
}

exports.updateProduct = async (req, res) => {
  const { product } = req.state
  const {
    name,
    price,
    category,
    subcategory,
    image,
    sku,
    status,
    unit,
    inventory,
  } = req.body
  let categoryFound
  if (category) {
    categoryFound = await db.Category.findById(category).lean()
    if (!categoryFound) return res.error('Category not found', 404)
    if (categoryFound.store.toString() !== product.store._id.toString()) return res.error('Unauthorized', 401)
    if (product.category.toString() !== categoryFound._id.toString()) product.category = categoryFound._id
  }
  let subcategoryFound
  if (subcategory) {
    subcategoryFound = await db.Subcategory.findById(subcategory).lean()
    if (!categoryFound) {
      return res.error('Category not found', 404)
    }
    if (!subcategoryFound) return res.error('Subcategory not found', 404)
    if (subcategoryFound.category.toString() !== categoryFound._id.toString()) return res.error('Invalid subcategory', 400)
    if (subcategoryFound.store.toString() !== product.store._id.toString()) return res.error('Unauthorized', 401)
    if (product.subcategory.toString() !== subcategoryFound._id.toString()) product.subcategory = subcategoryFound._id
  }
  if (name) product.name = name
  if (price) product.price = price
  if (image) {
    // check if image exists
    let file
    try {
      file = await db.File.findById(image)
    } catch (err) {
      console.error(err)
    }
    if (file) {
      // if image not exist, use body.image as product image
      file.status = statusConstants.FILE.USED
      file.save()
      product.image = file.url
    } else {
      product.image = image
    }
  }
  if (sku) product.sku = sku
  if (status !== undefined && product.status != status) product.status = status
  if (unit && productConstants.UNIT.includes(unit)) product.unit = unit
  if (inventory) product.inventory = inventory
  await product.save()
  res.success(product)
}
