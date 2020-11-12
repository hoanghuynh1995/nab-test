const db = require('../../db')

exports.createCategory = async (req, res, next) => {
  const { store } = req.state
  const {
    label,
    appliedTax = false,
  } = req.body
  if (!label) return res.error('label is required', 400)
  // check if category exist
  try {
    const existedCategory = await db.Category.findOne({
      store: store._id,
      label,
    })
    if (existedCategory) {
      return res.success(existedCategory)
    }
  } catch (err) {
    return res.error(err.message, 500)
  }
  let category
  try {
    category = await db.Category.create({
      store: store._id,
      label,
      appliedTax
    })
  } catch (err) {
    return res.error(err.message, 500)
  }
  res.success(category)
}

exports.getCategories = async (req, res) => {
  const { store } = req.state
  let categories
  try {
    categories = await db.Category.find({
      store: store._id,
    })
  } catch (err) {
    return res.error(err.message, 500)
  }
  res.success(categories)
}

exports.createSubcategory = async (req, res) => {
  const { store } = req.state
  const { categoryId: id } = req.params
  const {
    label,
    appliedTax = false,
  } = req.body
  if (!label) return res.error('label is required', 400)
  let category
  try {
    category = await db.Category.findById(id)
    if (!category) throw new Error('Category not found')
  } catch (err) {
    return res.error(err.message, 500)
  }
  try {
    const existedSubcategory = await db.Subcategory.findOne({
      store: store._id,
      label,
      category: category._id,
    })
    if (existedSubcategory) {
      return res.success(existedSubcategory)
    }
  } catch (err) {
    return res.error(err.message, 500)
  }
  let subcategory
  try {
    subcategory = await db.Subcategory.create({
      store: store._id,
      label,
      appliedTax,
      category: category._id,
    })
  } catch (err) {
    return res.error(err.message, 500)
  }
  return res.success(subcategory)
}