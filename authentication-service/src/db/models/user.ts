import * as Sequelize from 'sequelize'
const DataTypes = Sequelize.DataTypes

import connector from '../connector'

class UserModel extends Sequelize.Model {
  id?: number;
  email: string;
  password: string;
  fullname: string;
}

UserModel.init({
  id: {
    autoIncrement: true,
    type: DataTypes.INTEGER(),
    allowNull: false,
    primaryKey: true
  },
  email: {
    type: DataTypes.STRING(45),
    allowNull: false,
    unique: true,
  },
  password: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  fullname: {
    type: DataTypes.STRING(45),
    allowNull: false
  }
}, {
  sequelize: connector,
  tableName: 'users'
})

export default UserModel
