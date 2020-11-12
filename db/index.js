const { Sequelize } = require('sequelize')

const {
  db: {
    user,
    url,
    database,
    password,
    port,
  }
} = require('../config')

const sequelize = new Sequelize({
  dialect: 'postgres',
  host: url,
  username: user,
  password,
  database,
  port,
})
sequelize.authenticate().then(() => {
  console.log('Database connection has been established successfully.');
}).catch((err) => {
  console.error('Unable to connect to the database:', err);
  process.exit('-1');
})

module.exports = sequelize
