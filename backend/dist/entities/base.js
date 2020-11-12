"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const response = (data, message = 'Success', status = 1, errorCode = undefined) => {
    const res = {
        error: {
            status,
            message,
        },
        data,
        error_code: errorCode,
    };
    return res;
};
exports.default = response;
//# sourceMappingURL=base.js.map