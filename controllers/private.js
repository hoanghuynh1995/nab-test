const fs = require('fs')
const fsP = require('fs').promises
const path = require('path')
const multer = require('multer')
const XLSX = require('xlsx')

const Sharp = require('sharp')

const productConstants = require('../constants/product')
const db = require('../db')
const uploadService = require('../services/google-cloud-storage')
const statusConstants = require('../constants/status')

const GCS_PRODUCT_PATH = productConstants.GOOGLE_CLOUD_IMAGES_PATH

const tempDir = path.resolve(__dirname, '../tmp')
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir);
}
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Uploads is the Upload_folder_name 
    cb(null, tempDir)
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname)
  }
})

exports.upload = multer({
  storage,
  fileFilter: function (req, file, cb) {
    const filetypes = ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
    const fileExtensions = /xlsx|xls/
    const mimetype = filetypes.includes(file.mimetype);
    const extname = fileExtensions.test(path.extname(file.originalname).toLowerCase());
    if (mimetype && extname) {
      return cb(null, true);
    }

    cb("Error: File upload only supports the "
      + "following filetypes - " + filetypes);
  }
})

/**
 * private api use to upload products from excel file
 */
const helpers = {
  // remove first character if it is not number
  stringPriceToPrice: (str = '') => {
    if (typeof (str) === 'number') return str
    if (!str[0]) return 0
    let res
    if (isNaN(str[0])) {
      return Number(str.slice(1)) || 0
    }
    return Number(str)
  },
  getUnitAndValue: (str = '') => {
    str = str.trim()
    const splittedByX = str.split('x')
    if (splittedByX.length === 2) {
      return {
        unitValue: Number(splittedByX[0]),
        unit: 'ct',
      }
    }
    let res
    let startUnitPos = 0
    for (let i = 0; i < str.length; i++) {
      if (isNaN(str[i]) && str[i] !== '.') {
        startUnitPos = i
        break
      }
    }
    res = {
      unitValue: Number(str.slice(0, startUnitPos)),
      unit: str.slice(startUnitPos).toLowerCase(),
    }
    if (!res || !res.unitValue || !res.unit) return {
      unitValue: 1,
      unit: 'item',
    }
    return res
  }
}
exports.importProducts = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      result: 'failure',
      err: 'Missing file',
    });
  }
  console.log(req.file.path)
  const buf = fs.readFileSync(path.resolve(__dirname, req.file.path))
  if (!buf) {
    return console.error('Unable to read file')
  }
  const wb = XLSX.read(buf, { type: 'buffer' })

  const sheetIndex = req.body.sheet || 0
  const sheetName = wb.SheetNames[sheetIndex]
  const worksheet = wb.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json(worksheet)
  const products = rows.map(row => {
    const { unit, unitValue } = helpers.getUnitAndValue(row['size'])
    return {
      name: row['Product name'],
      price: helpers.stringPriceToPrice(row['Price']),
      image: row['Product Picture File Name'],
      category: row['Catagory'],
      subcategory: row['Sub-catagory'],
      sku: '',
      unit,
      unitValue,
      size: row['size'],
      // unit: !['l', 'ml', 'oz', 'ct'].includes(unit) ? 'item' : unit,
      // unitValue: !['l', 'ml', 'oz', 'ct'].includes(unit) ? 1 : unitValue,
    }
  })
  let importResults = []
  try {
    // importResults = await Promise.all(products.map(handleImportingOneProduct))
    for (let i = 0; i < products.length; i++) {
      const product = await handleImportingOneProduct(products[i])
      importResults.push(product)
      console.log('done', i)
    }
  } catch (err) {
    return res.error(err.message)
  }
  res.success(importResults)
  fsP.unlink(req.file.path)
}

exports.updateProductsSize = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      result: 'failure',
      err: 'Missing file',
    });
  }
  console.log(req.file.path)
  const buf = fs.readFileSync(path.resolve(__dirname, req.file.path))
  if (!buf) {
    return console.error('Unable to read file')
  }
  const wb = XLSX.read(buf, { type: 'buffer' })

  const sheetIndex = req.body.sheet || 0
  const sheetName = wb.SheetNames[sheetIndex]
  const worksheet = wb.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json(worksheet)
  const products = rows.map(row => {
    return {
      name: row['Product name'],
      size: row['size'] || row['Size'],
    }
  })
  try {
    for (let i = 0; i < products.length; i++) {
      await handleUpdatingProductSize(products[i])
      console.log('done', i)
    }
  } catch (err) {
    return res.error(err.message)
  }
  res.success(true)
  fsP.unlink(req.file.path)
}

const handleImportingOneProduct = async (product) => {
  // check if product exist
  let productFound
  try {
    productFound = await db.AvailableProduct.findOne({
      name: product.name
    })
  } catch (err) {
    console.error(err, product)
    return Promise.resolve()
  }
  if (productFound) return Promise.resolve()

  let file
  if (product.image) {
    // compress image before upload
    const filePath = path.resolve(tempDir, product.image)
    try {
      const buffer = await Sharp(filePath).jpeg({
        quality: 60,
      }).toBuffer()
      await fsP.writeFile(filePath, buffer);
      // upload to cloud
      const { url, bucket } = await uploadService.uploadFile(filePath, GCS_PRODUCT_PATH)
      // save image
      file = await db.File.create({
        filename: product.image,
        bucket: bucket,
        url: url,
      })
    } catch (err) {
      // skip image
      console.error(err, product)
    }
  }

  // find or create category
  let category
  try {
    category = await db.AvailableCategory.findOne({
      label: product.category,
    })
  } catch (err) {
    console.error(err)
    return Promise.resolve()
  }
  if (!category) {
    // create
    category = await db.AvailableCategory.create({
      label: product.category
    })
  }
  let subcategory
  if (product.subcategory) {
    // find or create subcategory
    try {
      subcategory = await db.AvailableSubcategory.findOne({
        label: product.subcategory,
      })
    } catch (err) {
      console.error(err)
      return Promise.resolve()
    }
    if (!subcategory) {
      // create
      subcategory = await db.AvailableSubcategory.create({
        label: product.subcategory
      })
    }
  }
  // create product
  let createdProduct
  try {
    createdProduct = await db.AvailableProduct.create({
      name: product.name,
      price: product.price,
      image: file ? file.url : '',
      category: category._id,
      subcategory: subcategory ? subcategory._id : undefined,
      unit: product.unit.toLowerCase(),
      unitValue: product.unitValue,
    })
  } catch (err) {
    console.error(err, product)
    return Promise.resolve()
  }
  if (file) {
    file.status = statusConstants.FILE.USED
    file.save()
  }
  return createdProduct
}

const handleUpdatingProductSize = async (product) => {
  // check if product exist
  let productFound
  try {
    productFound = await db.Product.findOne({
      name: product.name,
      size: { $exists: false }
    })
  } catch (err) {
    console.error(err, product)
    return Promise.resolve()
  }
  if (!productFound) return Promise.resolve()
  productFound.size = product.size
  await productFound.save()
}

const importLiquorProductsToStore = async () => {
  const storeId = ''
  const store = await db.Store.findById(storeId)
  if (!store) return
  const categories = ['5ef6d99aa332c29e59f09447', '5ef5c61ca9b557e5a0d7be7d']
  let currentProduct, currentIndex = 0
  const subcategories = {}

  do {
    currentProduct = await db.AvailableProduct.findOne({
      category: {
        $in: categories,
      }
    }).populate({
      model: 'available_subcategories',
      path: 'subcategory'
    }).skip(currentIndex).lean()
    if (!currentProduct) break
    if (!subcategories[currentProduct.subcategory.label]) {
      subcategories[currentProduct.subcategory.label] = await db.Subcategory.create({
        store: storeId,
        label: currentProduct.subcategory.label,
        category: currentProduct.category
      })
    }
    const payload = {
      ...currentProduct,
      _id: undefined,
      store: storeId,
      subcategory: subcategories[currentProduct.subcategory.label]._id,
    }
    try {
      await db.Product.create(payload)
    } catch (err) {
      console.log('ERROR', payload)
    }
    console.log({ name: currentProduct.name, index: currentIndex })
    currentIndex++
  } while (true)
}
// importLiquorProductsToStore()

exports.addStoreProducts = async (req, res) => {
  const { storeId } = req.body
  if (!storeId) return res.error('Missing storeId')
  let store
  try {
    store = await db.Store.findById(storeId)
  } catch (err) {
    return res.error(err)
  }
  if (!store) return res.error('Store not found')
  let result = []
  try {
    for (let i = 0; i < 54658; i++) {
      console.log('handling', i)
      try {
        await addAProduct(store, i)
      } catch (err) {
        result.push({
          i,
          res: false,
        })
        continue
      }
      result.push({
        i,
        res: true,
      })
    }
  } catch (err) {
    return res.error(err)
  }
  res.success(product)
}
const addAProduct = async (store, skip = 0) => {
  let availableProduct
  try {
    availableProduct = await db.AvailableProduct.findOne()
      .populate({
        path: 'category',
        model: db.AvailableCategory,
      }).populate({
        path: 'subcategory',
        model: db.AvailableSubcategory,
      }).skip(skip)
  } catch (err) {
    console.error(err)
    throw err
  }
  // check if category exists
  let category
  if (availableProduct.category) {
    try {
      category = await db.Category.findOne({
        store: store._id,
        label: availableProduct.category.label,
      }).lean()
      if (!category) {
        // create one
        category = await db.Category.create({
          store: store._id,
          label: availableProduct.category.label,
        })
      }
    } catch (err) {
      console.error(err)
      throw err
    }
  }
  let subcategory
  if (category && availableProduct.subcategory) {
    // check if subcategory exists
    try {
      subcategory = await db.Subcategory.findOne({
        store: store._id,
        label: availableProduct.subcategory.label,
        category: category._id
      }).lean()
      if (!subcategory) {
        // create one
        subcategory = await db.Subcategory.create({
          store: store._id,
          label: availableProduct.subcategory.label,
          category: category._id
        })
      }
    } catch (err) {
      console.error(err)
      throw err
    }
  }
  // check if product exists
  try {
    const product = await db.Product.findOne({
      store: store._id,
      name: availableProduct.name,
    })
    if (product) throw new Error('Product existed')
  } catch (err) {
    console.error(err)
    throw err
  }
  let product
  try {
    product = await db.Product.create({
      name: availableProduct.name,
      price: availableProduct.price,
      image: availableProduct.image,
      category: category ? category._id : undefined,
      subcategory: subcategory ? subcategory._id : undefined,
      store: store._id,
      sku: skip + 1,
      unit: 'item',
      inventory: 0,
      status: Boolean(Math.round(Math.random())),
    })
  } catch (err) {
    console.error(err)
    throw err
  }
  return product
}