const express = require("express");
const { markAttendance } = require("../controllers/attendanceController");
const { requireAuth, requireRole } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/", (req, res) => {
    return res.status(404).json({
        success: false,
        message: "Not found",
    });
});

// Attendance requires a signed-in admin or employee.
router.post(
    "/mark",
    requireAuth,
    requireRole("admin", "employee"),
    markAttendance
);

module.exports = router;
