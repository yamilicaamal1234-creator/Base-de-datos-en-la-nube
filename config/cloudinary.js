const cloudinary = require('cloudinary').v2;
const multer = require('multer');

// Configurar con las variables del .env
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configurar Multer para guardar el archivo temporalmente en la memoria del servidor
// antes de enviarlo directamente a Cloudinary
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

module.exports = { cloudinary, upload };