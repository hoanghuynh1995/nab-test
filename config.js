const path = require('path')
const dotenv = require('dotenv')
dotenv.config({ path: path.resolve(__dirname, '.env') })

module.exports = {
  port: process.env.PORT || 8080,
  db: {
    url: process.env.PG_URL,
    user: process.env.PG_USER,
    password: process.env.PG_PASSWORD,
    database: process.env.PG_DATABASE,
    port: process.env.PG_PORT,
  },
}
