import pg from 'pg';

const { Client } = pg;

const client = new Client({
            
                user: process.env.DB_USER,
                host: process.env.DB_HOST,
                database: process.env.DB_NAME,
                password: String(process.env.DB_PASSWORD),
                port: process.env.DB_PORT,
      
        });


export async function start() {
    try {

        await client.connect();
        console.log("connected to database successfully");

    } catch (error) {
        console.log(error)
        process.exitCode = 1;
    }
}

const dbString = process.env.DATABASE_URL
const jwtsecret =process.env.JWT_SECRET
export default  {dbString , jwtsecret} ;






