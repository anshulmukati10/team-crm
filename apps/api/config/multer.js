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
        (result) => {
            if (result?.error) {
                console.error("Cloudinary upload failed:", result.error.message || result.error)
                return res.status(502).json({
                    success: false,
                    message: result.error.message || "Cloudinary upload failed.",
                })
            }

            if (!result?.secure_url || !result.public_id) {
                console.error("Cloudinary upload returned an invalid response.")
                return res.status(502).json({
                    success: false,
                    message: "Cloudinary did not return the uploaded file details.",
                })
            }

            return res.status(201).json({
                success: true,
                message: "File uploaded.",
                url: result.secure_url,
                public_id: result.public_id,
            })
        },
        { folder: "team", resource_type: "auto" },
    )

    uploadStream.end(file.buffer)
}