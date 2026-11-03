import multer from 'multer'
import cloudinary from 'cloudinary'
import {prisma} from './prismaClient.js'


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

    const userId = Number(req.user?.id)
    if (!Number.isSafeInteger(userId) || userId <= 0) {
        return res.status(401).json({
            success: false,
            message: "User authentication required.",
        })
    }

    let user
    try {
        user = await prisma.user.findUnique({
            where: { id: userId },
            select: { memberOf: true },
        })
    } catch (error) {
        console.error("Unable to find recording owner:", error)
        return res.status(500).json({
            success: false,
            message: "Unable to verify recording owner.",
        })
    }

    if (!user?.memberOf) {
        return res.status(403).json({
            success: false,
            message: "Recordings can only be uploaded by a company team member.",
        })
    }

    const uploadStream = cloudinary.uploader.upload_stream(
        async (result) => {
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
            try {
                await prisma.recordings.create({
                    data: {
                        companyId: user.memberOf,
                        url: result.secure_url,
                    }
                })
            } catch (error) {
                console.error("Unable to save uploaded recording:", error)
                return res.status(500).json({
                    success: false,
                    message: "The recording uploaded but could not be saved to the company.",
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