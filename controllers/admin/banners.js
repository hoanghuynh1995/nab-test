const db = require('../../db')
const {
  BANNER: BANNER_STATUS,
  FILE: FILE_STATUS,
} = require('../../constants/status')

exports.setBanner = async (req, res) => {
  const { image, deepLink } = req.body
  // check if image exists
  let file
  try {
    file = await db.File.findById(image)
  } catch (err) {
    console.error(err)
  }
  if (!file) return res.error('Image not found')
  file.status = FILE_STATUS.USED
  file.save()
  let banner
  try {
    banner = await db.Banner.create({
      image: file.url,
      deepLink,
    })
  } catch (err) {
    return res.error(err.message)
  }
  res.send(banner)
}

exports.getBanners = async (req, res) => {
  let banners
  try {
    banners = await db.Banner.find({
      // status: BANNER_STATUS.ACTIVE,
      deleted: { $ne: true },
    })
  } catch (err) {
    return res.error(err.message)
  }
  res.success(banners)
}

exports.updateBanner = async (req, res) => {
  const { id } = req.params
  const { status, deepLink } = req.body
  let banner
  try {
    banner = await db.Banner.findById(id)
  } catch (err) {
    return res.error(err.message)
  }
  if (!banner) return res.error('Banner not found')
  if (status !== undefined) banner.status = status
  banner.deepLink = deepLink
  await banner.save()
  res.success(banner)
}

exports.removeBanner = async (req, res) => {
  const { id } = req.params
  let banner
  try {
    banner = await db.Banner.findById(id)
  } catch (err) {
    return res.error(err.message)
  }
  if (!banner) return res.error('Banner not found')
  banner.deleted = true
  await banner.save()
  res.success(banner)
}
