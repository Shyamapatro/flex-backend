const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const port = 3002;
app.use(cors());

const uploadsDir = path.join(__dirname, './uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true }); }

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    console.log("Saving file to uploads directory:", uploadsDir);
    cb(null, uploadsDir);  
  },
  filename: function (req, file, cb) {
    const filename = `${Date.now()}-${file.originalname}`;
    console.log("Generated filename:", filename);  
    cb(null, filename);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    console.log("Received file type:", file.mimetype);  
    if (file.mimetype === 'image/png' || file.mimetype === 'image/jpeg') {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

app.use(express.json());


app.post('/upload', upload.single('image'), (req, res) => {
  if (!req.file) {
    console.error("No file uploaded");
    return res.status(400).send('No file uploaded.');
  }

  console.log("File uploaded:", req.file); 
  res.json({ filePath: `/uploads/${req.file.filename}` });
});


app.post('/process', async (req, res) => {
  const { filePath, brightness, contrast, saturation, rotation, format } = req.body;

  if (!filePath) {
    return res.status(400).send('File path is required.');
  }

  const sanitizedFilePath = filePath.replace(/^\/uploads\//, '');
  const imagePath = path.join(uploadsDir, sanitizedFilePath);
  console.log("Resolved image path:", imagePath);

  if (!fs.existsSync(imagePath)) {
    console.error("File not found at:", imagePath);
    return res.status(404).send('File not found.');
  }

  try {
    const processedImage = sharp(imagePath)
      .rotate(rotation || 0)
      .modulate({
        brightness: brightness || 1,
        contrast: contrast || 1,
        saturation: saturation || 1
      });

    const processedFileName = `${Date.now()}.${format || 'jpeg'}`;
    const processedFilePath = path.join(uploadsDir, processedFileName);

    await processedImage
      .toFormat(format || 'jpeg')
      .toFile(processedFilePath);

    res.json({
      message: 'Image processed successfully.',
      filePath: `/uploads/${processedFileName}`
    });
  } catch (error) {
    console.error("Error processing image:", error);
    res.status(500).send('Error processing image.');
  }
});


app.post('/download', (req, res) => {
  const { filePath, format } = req.body;

  if (!filePath) {
    return res.status(400).send('File path is required.');
  }

  const sanitizedFilePath = path.join(uploadsDir, path.basename(filePath));

  if (!fs.existsSync(sanitizedFilePath)) {
    console.error("File not found at:", sanitizedFilePath);
    return res.status(404).send('File not found.');
  }

  console.log("Sanitized File Path:", sanitizedFilePath);

  const fileStream = fs.createReadStream(sanitizedFilePath);

  const mimeType = `image/${format || 'jpeg'}`;
  res.setHeader('Content-Disposition', `attachment; filename=processed.${format || 'jpeg'}`);
  res.setHeader('Content-Type', mimeType);

  fileStream.pipe(res);

  fileStream.on('end', () => {
    console.log("File stream ended successfully.");
  });

  fileStream.on('error', (error) => {
    console.error("Error reading file stream:", error);
    return res.status(500).send('Error downloading file.');
  });
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
