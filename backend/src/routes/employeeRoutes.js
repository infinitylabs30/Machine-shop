const express = require("express");
const {
    getEmployees,
    createEmployee,
} = require("../controllers/employeeController");
const {
    requireAuth,
    requireRole,
} = require("../middleware/authMiddleware");

const router = express.Router();

router.use(requireAuth, requireRole("admin"));

router.get("/", getEmployees);
router.post("/", createEmployee);

module.exports = router;