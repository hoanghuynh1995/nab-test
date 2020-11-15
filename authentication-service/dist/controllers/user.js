"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const constants_1 = require("../constants");
const base_1 = __importDefault(require("../entities/base"));
const db_1 = __importDefault(require("../db"));
const utils_1 = __importDefault(require("../utils"));
const signup = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { email, password, fullname, } = req.body;
    try {
        const user = yield db_1.default.User.findOne({
            where: { email }
        });
        if (user)
            throw new Error('Email existed');
    }
    catch (err) {
        const body = base_1.default(null, err.message, 0, constants_1.error_codes.DB_QUERY);
        res.send(body);
        return;
    }
    const hashedPassword = yield utils_1.default.auth.generateHash(password);
    const userData = {
        email,
        password: hashedPassword,
        fullname,
    };
    let user;
    try {
        user = yield db_1.default.User.create(userData);
    }
    catch (err) {
        const body = base_1.default(null, err.message, 0, constants_1.error_codes.DB_QUERY);
        next(body);
        return;
    }
    delete user.password;
    res.send(user);
});
const login = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { email, password, } = req.body;
    let user;
    try {
        user = yield db_1.default.User.findOne({
            where: { email },
            raw: true,
        });
    }
    catch (err) {
        const body = base_1.default(null, err.message, 0, constants_1.error_codes.DB_QUERY);
        res.send(body);
        return;
    }
    if (!user) {
        const body = base_1.default(null, 'Invalid Email or Password', 0, constants_1.error_codes.BAD_REQUEST);
        res.send(body);
        return;
    }
    // compare password hash
    const valid = yield utils_1.default.auth.compareHash(password, user.password);
    if (!valid) {
        const body = base_1.default(null, 'Invalid Email or Password', 0, constants_1.error_codes.BAD_REQUEST);
        res.send(body);
        return;
    }
    delete user.password;
    // generate token
    const token = yield utils_1.default.auth.generateToken(user);
    const response = Object.assign(Object.assign({}, user), { token });
    res.send(response);
});
const verifyToken = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { token, } = req.body;
    let response;
    try {
        response = yield utils_1.default.auth.verifyToken(token);
    }
    catch (err) {
        const body = base_1.default(null, 'Invalid token', 0, constants_1.error_codes.BAD_REQUEST);
        res.send(body);
        return;
    }
    res.send(response);
});
exports.default = {
    signup,
    login,
    verifyToken,
};
//# sourceMappingURL=user.js.map