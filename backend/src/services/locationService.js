const pool = require("../config/database");

/**
 * Calculate distance between two GPS coordinates.
 * Uses the Haversine formula.
 *
 * @returns distance in meters
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
    const earthRadius = 6371000;

    const toRadians = (degrees) => {
        return (degrees * Math.PI) / 180;
    };

    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);

    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRadians(lat1)) *
            Math.cos(toRadians(lat2)) *
            Math.sin(dLon / 2) ** 2;

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return earthRadius * c;
}


/**
 * Find the company location where the employee currently is.
 */
async function findValidLocation(latitude, longitude) {
    const result = await pool.query(`
        SELECT
            id,
            name,
            address,
            latitude,
            longitude,
            allowed_radius_meters
        FROM locations
        WHERE is_active = TRUE
    `);

    for (const location of result.rows) {
        const distance = calculateDistance(
            latitude,
            longitude,
            Number(location.latitude),
            Number(location.longitude)
        );

        if (distance <= location.allowed_radius_meters) {
            return {
                valid: true,
                location,
                distance: Math.round(distance * 100) / 100,
            };
        }
    }

    return {
        valid: false,
        location: null,
        distance: null,
    };
}

module.exports = {
    calculateDistance,
    findValidLocation,
};

