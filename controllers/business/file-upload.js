const multer = require('multer')
const fs = require('fs')
const path = require('path')

const Sharp = require('sharp')

const uploadService = require('../../services/google-cloud-storage')
const db = require('../../db')

const tempDir = path.resolve(__dirname, '../../tmp')
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir);
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Uploads is the Upload_folder_name 
    cb(null, tempDir)
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + ".jpg")
  }
}) 

exports.upload = multer({
  storage,
  limits: {
    fileSize: 4 * 1024 * 1024,
  },
  fileFilter: function (req, file, cb) {
    const filetypes = /jpeg|jpg|png/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    if (mimetype && extname) {
      return cb(null, true);
    }

    cb("Error: File upload only supports the "
      + "following filetypes - " + filetypes);
  },
})

exports.compressImage = async (req, res, next) => {
  try {
    const buffer = await Sharp(req.file.path).jpeg({
      quality: 60,
    }).toBuffer()
    fs.writeFile(req.file.path, buffer, function (e) {
      return next()
    });
  } catch (err) {
    console.error('compressImage', err)
    return next()
  }
}

exports.uploadToCloud = async (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({
      result: 'failure',
      err: 'Missing image',
    });
  }
  req.state.userId = '5ee07a6ba0b0c47c9654364b' // TODO: remove fake
  const { url, bucket } = await uploadService.uploadFile(req.file.path, req.state.userId)
  req.file.url = url
  req.file.bucket = bucket
  // remove from fs
  fs.unlink(req.file.path, () => {})
  next()
}

exports.saveImage = async (req, res) => {
  const file = await db.File.create({
    filename: req.file.filename,
    bucket: req.file.bucket,
    url: req.file.url,
  })
  return res.status(200).json({
    result: 'success',
    file: file,
  });
}
