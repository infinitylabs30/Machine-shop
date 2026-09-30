const jwt = require("jsonwebtoken");

function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization || "";
    const [scheme, token] = authHeader.split(" ");

    if (scheme !== "Bearer" || !token) {
        return res.status(401).json({
            success: false,
            message: "Authentication required",
        });
    }

    if (!process.env.JWT_SECRET) {
        console.error("JWT_SECRET is not configured");
        return res.status(500).json({
            success: false,
            message: "Authentication is not configured",
        });
    }

    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET);
        return next();
    } catch {
        return res.status(401).json({
            success: false,
            message: "Invalid or expired session",
        });
    }
}

function requireRole(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: "You do not have permission to perform this action",
            });
        }

        return next();
    };
}

module.exports = { requireAuth, requireRole };
