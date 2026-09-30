const express = require("express");
const { getMonthlyReport } = require("../controllers/reportController");
const {
    requireAuth,
    requireRole,
} = require("../middleware/authMiddleware");

const router = express.Router();

router.use(requireAuth, requireRole("admin"));
router.get("/monthly", getMonthlyReport);

module.exports = router;
