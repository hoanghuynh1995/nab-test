import express from 'express'
import cors from 'cors'
import morgan from 'morgan'

import config from './config'
import routes from './routes'
import bodyParser from 'body-parser'

const app = express()
const port = config.port

//fetch db update object 
require('./db')

app.use(
  morgan((tokens, req, res) => {
    return [
      tokens.method(req, res),
      tokens.url(req, res),
      tokens.status(req, res),
      tokens.res(req, res, 'content-length'),
      '-',
      tokens['response-time'](req, res),
      'ms',
    ].join(' ')
  })
)

app.use(bodyParser.urlencoded({ extended: true }))

// setup cors
app.use(cors())
app.use('/', routes)

app.listen(port, () => console.log('Started server at port: ' + port))
