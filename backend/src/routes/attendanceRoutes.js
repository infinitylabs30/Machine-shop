const express = require("express");

const {
    markAttendance,
} = require("../controllers/attendanceController");

const router = express.Router();

router.post("/mark", markAttendance);

module.exports = router;
