import genToken from '../config/token.js'
import asyncHandler from '../middleware/asyncMiddleware.js'
import { prisma } from '../config/prismaClient.js';
import bcrypt from 'bcrypt'
import { emitWorkspaceUpdate } from '../config/socket.js'


/* #swagger.tags = ['Authentication'] */

export const createUSer = asyncHandler(async (req, res) => {
    try {
        const { name, email, password, role } = req.body;
        if (!name || !email || !password || !role) {
            return res.status(400).json({ message: " all fields required " })
        }
        const userExist = await prisma.user.findUnique({ where: { email: email } });
        if (userExist) {
            return res.status(409).json({ message: "user already exist" })
        }
        const hashedPass = await bcrypt.hash(password, 10)
        await prisma.user.create(
            {
                data:
                {
                    name: name,
                    email: email,
                    password: hashedPass,
                    role: role.toUpperCase()
                },
                select:
                {
                    id: true,
                    name: true,
                    email: true,
                    role: true,
                    password: true
                }
            })
        emitWorkspaceUpdate()
        return res.status(201).json({ message: " user created " })

    }
    catch (err) {
        return res.status(500).json({ error: err })
    }
})


export const loginUser = asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    try {
        if (!email || !password) {
            return res.status(400).json({ message: "all field are required" })
        }
        const User = await prisma.user.findUnique({ where: { email: email } })
        if (!User) {
            return res.status(403).json({ message: `no user exist with ${email}` })
        }
        const isPass = await bcrypt.compare(password, User.password)
        if (!isPass) {
            return res.status(401).json({ message: " invalid credentials" })
        }

        const token = genToken(User);
        res.cookie('token', token, {
            httpOnly: true,
            secure: false,
            sameSite: 'lax',
            maxAge: 30 * 24 * 60 * 60 * 1000
        });
        res.json({
            userId: User.id,
            userName: User.name,
            userEmail: User.email,
            userRole: User.role
        })


    } catch (error) {
        return res.status(500).json({ error: error?.message || "internal server error " })
    }
})



export const logoutUser = asyncHandler(async (req, res) => {
    try {
        res.cookie('token', '', {
            httpOnly: true,
            maxAge: new Date(0)
        })
        return res.status(200).json({ message: " user logged out " })
    } catch (error) {
        return res.status(500).json({ message: " problem in logging out user " })
    }
})


export const deleteUser = asyncHandler(async (req, res) => {
    try {
        const id = req.query.id;
        if (!id) {
            return res.status(401).json({ message: " id required " })
        }
        const numericId = Number(id)
        const isAdmin = await prisma.user.findUnique({ where: { id: numericId } })
        if (isAdmin.role === "ADMIN") {
            return res.status(404).json({ message: "admin can't be deleted " })
        }

        console.log("id " + numericId)
        await prisma.user.delete({ where: { id: numericId } })
        emitWorkspaceUpdate()
        return res.status(200).json({ message: "user deleted" })
    }
    catch (error) {
        return res.status(500).json({ message: "server errored at deleting user " })
    }
})

// export const updateUser = asyncHandler (async(req,res)=>
// {

// })


export const getProfile = asyncHandler(async (req, res) => {
    try {
        const userId = req.user.id;
        const numericUserId = Number(userId);
        const user = await prisma.user.findUnique({ where: { id: numericUserId } });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        res.json({
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role
        });
    } catch (error) {
        return res.status(500).json({ message: "Server error while fetching profile" });
    }
});


export const updateProfile = asyncHandler(async (req, res) => {
    try {
        const userId = req.user.id;
        const numericUserId = Number(userId);
        const { name, email, password } = req.body;
        const user = await prisma.user.findUnique({ where: { id: numericUserId } });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        const updatedUser = await prisma.user.update({
            where: { id: numericUserId }, data: {
                name: (name == undefined ? user.name : name),
                email: (email == undefined ? user.email : email),
                password: (password == undefined ? user.password : password)
            }
        });
        emitWorkspaceUpdate()
        res.json({
            id: updatedUser.id,
            name: updatedUser.name,
            email: updatedUser.email,
            role: updatedUser.role
        });
    } catch (error) {
        return res.status(500).json({ message: "Server error while updating profile" });
    }
});

export const socketConnection = asyncHandler(async (req, res) => {
    const roomId = req.params.id;
    try {
        const room = await prisma.room.findUnique({ where: { id: roomId } });
        if (!room) return res.status(404).json({ message: "Room not found" });

        const member = await prisma.groupMember.findUnique({
            where: {
                roomId_userId: {
                    userId: Number(req.user.id),
                    roomId : roomId
                }
            }
        });
        if (!member) return res.status(403).json({ message: "You are not a member of this room" });

        const messages = await prisma.message.findMany({
            where: { roomId: roomId },
            include: {
                user: {
                 select :    {name: true,
                    role: true}
                }
            },
            orderBy: { createdAt: 'asc' }
        })
        res.json(messages)
    } catch (error) {
        console.error(` Error : ${error}`)
        return res.status(500).json({ message: " can not fetch chat " })
    }
})



export const getRooms = asyncHandler(async (req, res) => {
    try {
        const userId = Number(req.user.id)
        if (!Number.isInteger(userId)) {
            return res.status(401).json({ message: "User not found" })
        }
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true }
        })
        if (!user) return res.status(401).json({ message: "User not found" })

        const rooms = await prisma.room.findMany({
            where: { member: { some: { userId: user.id } } },
            select: {
                id: true,
                name: true,
                createdAt: true,
                member: { select: { userId: true } }
            }
        });

        return res.status(200).json({
            success: true,
            rooms: rooms.map(({ member, ...room }) => ({
                ...room,
                memberIds: member.map(({ userId }) => userId)
            }))
        });
    } catch (error) {
        console.error(error)
        return res.status(500).json({ message: "Error in fetching rooms" })
    }
})