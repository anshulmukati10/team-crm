import multer from 'multer'
import cloudinary from 'cloudinary'

cloudinary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.CLOUD_KEY,
    api_secret: process.env.CLOUD_SECRET
})

const storage = multer.memoryStorage();
export const upload = multer({ storage: storage })

export const multerController = async (req, res) => {
    const file = req.file
    if (!file) {
        return res.status(400).json({
            success: false,
            message: "No file was uploaded.",
        })
    }

    const uploadStream = cloudinary.uploader.upload_stream(
        { folder: "team", resource_type: "auto" },
        (error, result) => {
            if (error) {
                console.error("Cloudinary upload failed:", error)
                return res.status(502).json({
                    success: false,
                    message: error.message || "Cloudinary upload failed.",
                })
            }

            return res.status(201).json({
                success: true,
                message: "File uploaded.",
                url: result.secure_url,
                public_id: result.public_id,
            })
        },
    )

    uploadStream.end(file.buffer)
}