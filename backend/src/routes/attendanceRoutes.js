const express = require("express");
const { markAttendance } = require("../controllers/attendanceController");

const router = express.Router();

router.post("/", (req, res) => {
    return res.status(404).json({
        success: false,
        message: "Not found",
    });
});

// Public attendance marking; employee identity is verified by code and face.
router.post("/mark", markAttendance);

module.exports = router;
