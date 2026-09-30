const express = require("express");

const {
    registerEmployeeFace,
    verifyEmployeeFace,
} = require("../controllers/faceController");

const {
    requireAuth,
    requireRole,
} = require("../middleware/authMiddleware");

const router = express.Router();

// Face registration and template verification are admin-only for now.
router.use(requireAuth, requireRole("admin"));

router.post("/register", registerEmployeeFace);
router.post("/verify", verifyEmployeeFace);

module.exports = router;
