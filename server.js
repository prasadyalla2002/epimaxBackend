const express = require('express')
const {open} = require('sqlite')
const path = require('path')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

const sqlite3 = require('sqlite3')

const app = express()

app.use(express.json())

const dbpath = path.join(__dirname,"epimax.db")

let db = null;

const initilzieDb = async() =>{
    try{
        db = await open({
            filename: dbpath,
            driver:sqlite3.Database
        });
        app.listen(3000, () => console.log("server running at port 3000"));
    }catch(error){
        console.log(`DB Error:${error.message}`)
        process.exit(1);
    }
}


initilzieDb()

///Authentication Middleware

const authenticateToken = (req,res,next) =>{
    let jwtToken;
    const authHeader = req.headers["authorization"];
    if (authHeader !== undefined){
        jwtToken = authHeader.split(" ")[1];
    }
    if(jwtToken === undefined){
        res.status(401);
        res.send("Invalid JWT Token");
    }else{
        jwt.verify(jwtToken, 'MY_SECRET_TOKEN', async(error,payload) =>{
            if (error){
                res.status(401);
                res.send("Invalid JWT Token")
            }else{
                next();
            }
        })
    }
}

/// Register User
app.post('/register', async(req,res) =>{
    const {username,password} = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const selectQuery = `
    SELECT *
    FROM Users
    WHERE username = '${username}';`
    const user = await db.get(selectQuery)

    if(user === undefined){
        const createUserQuery = `
        INSERT INTO
            Users(username,password)
        VALUES
        (
            '${username}',
            '${hashedPassword}'
        );
        `
        const dbResponse = await db.run(createUserQuery);
        const newUserId = dbResponse.lastID;
        res.send(`New User Registered With Id :${newUserId}`);
    }else{
        res.status = 400;
        res.send('User already exists');
    }
})

/// Login User 

app.post('/login', async(req,res) =>{
    const {username,password} = req.body;
    const selectUser = `SELECT * FROM Users WHERE username='${username}'`;
    const dbUser = await db.get(selectUser);

    if(dbUser === undefined){
        res.status(400);
        res.send('Invalid User');
    }else{
        const isPasswordMatch = await bcrypt.compare(password,dbUser.password);
        if (isPasswordMatch === true){
            const payload = {
                username:username,
            };
            const jwtToken = jwt.sign(payload, 'MY_SECRET_TOKEN')
            res.send({jwtToken});
        }else{
            res.status(400);
            res.send('Invalid Password');
        }
    }
})

/// Add task

app.post('/tasks',authenticateToken,async(req,res) =>{
    const taskDetails = req.body;
    const {id,title,description,assigneeId,createdAt,updatedAt} = taskDetails
    const query = `
    INSERT INTO
        Tasks(title,description,assigneeId,createdAt,updatedAt)
    VALUES(
        '${title}',
        '${description}',
        ${assigneeId},
        '${createdAt}',
        '${updatedAt}'
    );
    `
    const dbResponse = await db.run(query);
    const taskId = dbResponse.lastID;
    res.send(`{Added task with ID: ${taskId}}`)
})

/// Get all Tasks

app.get('/tasks', async(req,res) =>{
    const query = `
    SELECT *
    FROM Tasks`

    const dbResponse = await db.all(query)
    res.send(dbResponse);
})

/// Get Task by Id

app.get('/tasks/:taskId', async(req,res) =>{
    const taskId = req.params;
    const id = taskId.taskId
    const query = `
    SELECT * 
    FROM Tasks
    WHERE id = ${id}; 
    `
    const dbResponse = await db.get(query);
    res.send(dbResponse);
})

/// Update Task by Id

app.put('/tasks/:id',authenticateToken, async(req,res) =>{
    const taskId = req.params;
    const tid = taskId.id
    const taskDetails = req.body
    const {title,description,assigneeId,createdAt,updatedAt} = taskDetails

    const query = `
    UPDATE
        Tasks
    SET
        title='${title}',
        description='${description}',
        assigneeId=${assigneeId},
        createdAt='${createdAt}',
        updatedAt='${updatedAt}'
    WHERE 
        id=${tid};
    `
    await db.run(query)
    res.send("Task Updated Successfully")
});

///Delete a Task by Id

app.delete('/tasks/:id',authenticateToken, async(req,res) =>{
    const{id} = req.params
    const query = `
    DELETE 
    FROM Tasks
    WHERE id= ${id};`

    await db.run(query)
    res.send("Task Deleted Successfully")

   
})