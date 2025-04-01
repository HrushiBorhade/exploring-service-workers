require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const app = express();

app.use(cors());
app.use(express.json());

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

app.post("/get-upload-url", async (req, res) => {
  try {
    const { filename, filetype } = req.body;
    const key = `uploads/${Date.now()}-${filename}`;

    const command = new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: key,
      ContentType: filetype,
    });

    const presignedurl = await getSignedUrl(s3Client, command, {
      expiresIn: 3600,
    });

    res.json({
      url: presignedurl,
      key,
    });
  } catch (error) {
    console.error(`Error generating presigned URL:${error}`);
    res.status(500).json({
      error: "Failed to generate upload URL",
    });
  }
});

app.post('/confirm-upload',async (req, res) => {
    // TODO: validate the upload
    const {key} = req.body;

    res.json({
        success:true,
        message: "Upload confirmed!",
        imageUrl: `https://${process.env.AWS_S3_BUCKET}.s3.amazonaws.com/${key}`
    })
})


const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
})