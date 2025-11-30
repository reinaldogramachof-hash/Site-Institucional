"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validate = validate;
function validate(schema, source = 'body') {
    return (req, res, next) => {
        const { error } = schema.validate(req[source], { abortEarly: false });
        if (error)
            return res.status(400).json({ error: 'validation', details: error.details });
        next();
    };
}
