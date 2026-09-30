const axios = require("axios");

const FACE_SERVICE_URL =
    process.env.FACE_SERVICE_URL || "http://127.0.0.1:5100";

async function registerFace(image) {
    const response = await axios.post(
        `${FACE_SERVICE_URL}/register`,
        { image },
        { timeout: 30000 }
    );

    return response.data;
}

async function verifyFace(image, embedding) {
    const response = await axios.post(
        `${FACE_SERVICE_URL}/verify`,
        {
            image,
            embedding,
        },
        { timeout: 30000 }
    );

    return response.data;
}

module.exports = {
    registerFace,
    verifyFace,
};
