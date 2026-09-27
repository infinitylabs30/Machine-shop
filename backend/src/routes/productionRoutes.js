const express = require("express");
const router = express.Router();

const {
    createProductionEntry,
    getProductionEntries,
    updateProductionEntry,
    deleteProductionEntry,
    getProductionLocations,
} = require("../controllers/productionController");

router.get("/locations", getProductionLocations);
router.get("/", getProductionEntries);
router.post("/", createProductionEntry);
router.put("/:id", updateProductionEntry);
router.delete("/:id", deleteProductionEntry);

module.exports = router;