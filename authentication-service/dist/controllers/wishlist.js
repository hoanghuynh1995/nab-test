"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const base_1 = __importDefault(require("../entities/base"));
const testmw1 = (req, res, next) => {
    console.log('testMw');
    const state = {
        x: 1
    };
    req.state = state;
    next();
};
const testmw2 = (req, res, next) => {
    const currentState = req.state;
    const state = Object.assign(Object.assign({}, currentState), { y: 2 });
    req.state = state;
    next();
};
const testmw3 = (req, res, next) => {
    const currentState = req.state;
    console.log('state3', currentState);
    res.send(base_1.default({ res: 1 }));
};
exports.default = {
    testmw1,
    testmw2,
    testmw3,
};
//# sourceMappingURL=wishlist.js.map