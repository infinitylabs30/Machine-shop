const express = require("express");

const {
    registerEmployeeFace,
    verifyEmployeeFace,
} = require("../controllers/faceController");

const router = express.Router();

router.post("/register", registerEmployeeFace);
router.post("/verify", verifyEmployeeFace);

module.exports = router;
