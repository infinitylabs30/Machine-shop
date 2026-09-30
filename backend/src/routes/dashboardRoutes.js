const express = require("express");
const { getDashboardSummary } = require("../controllers/dashboardController");
const { requireAuth, requireRole } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(requireAuth, requireRole("admin"));
router.get("/summary", getDashboardSummary);

module.exports = router;
