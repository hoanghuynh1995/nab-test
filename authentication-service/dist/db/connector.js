"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const config_1 = __importDefault(require("../config"));
const { db: { user, url, database, password, port, sync, } } = config_1.default;
console.log('config', config_1.default);
const sequelize = new sequelize_1.Sequelize(database, null, null, {
    dialect: 'postgres',
    host: url,
    username: user,
    password,
    port: Number(port),
});
sequelize.authenticate().then(() => {
    console.log('Database connection has been established successfully.');
    if (sync === 'true') {
        sequelize.sync({ alter: true });
    }
}).catch((err) => {
    console.error('Unable to connect to the database:', err);
    process.exit(-1);
});
exports.default = sequelize;
//# sourceMappingURL=connector.js.map