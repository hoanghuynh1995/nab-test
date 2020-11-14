"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.joiObjs = void 0;
const joi_1 = __importDefault(require("joi"));
const constants_1 = require("../constants");
const base_1 = __importDefault(require("../entities/base"));
const validate = (validator, path) => (req, res, next) => {
    let obj;
    if (path === 'body') {
        obj = req.body;
    }
    else if (path === 'query') {
        obj = req.query;
    }
    if (obj) {
        const vldRs = validator.validate(obj);
        if (vldRs.error) {
            const response = base_1.default(null, vldRs.error.message, 0, constants_1.error_codes.JOI_VALIDATION);
            next(response);
            return;
        }
        next();
        return;
    }
    next();
};
exports.joiObjs = {
    user: {
        createUser: joi_1.default.object({
            email: joi_1.default.string().email().required(),
            password: joi_1.default.string().required(),
            fullname: joi_1.default.string().required(),
        }),
        login: joi_1.default.object({
            email: joi_1.default.string().email().required(),
            password: joi_1.default.string().required(),
        }),
    },
};
exports.default = {
    validate,
};
//# sourceMappingURL=request-validation.js.map