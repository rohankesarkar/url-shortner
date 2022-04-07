const urlModel = require('../model/urlModel')
const shortid = require('short-id')
const validUrl = require('valid-url')
const redis = require('redis')

const { promisify } = require("util");

//Connect to redis
const redisClient = redis.createClient(
    16820,
    "redis-16820.c80.us-east-1-2.ec2.cloud.redislabs.com",
    { no_ready_check: true }
);
redisClient.auth("OTnq8rY1owfTtCuQR8ZeVZiEDn5P0ra6", function (err) {
    if (err) throw err;
});

redisClient.on("connect", async function () {
    console.log("Connected to Redis..");
});



//1. connect to the server
//2. use the commands :

//Connection setup for redis

const SET_ASYNC = promisify(redisClient.SET).bind(redisClient);
const GET_ASYNC = promisify(redisClient.GET).bind(redisClient);



const isValid = function (value) {
    if (typeof value === 'undefined' || value === null) return false;
    if (typeof value === 'string' && value.trim().length === 0) return false;
    return true
}

const isValidBody = function (body) {
    return Object.keys(body).length > 0
}

//**********************************************POST/url*****************************************************//
const baseUrl = 'http://localhost:3000'

const createUrl = async function (req, res) {
    try {
        const longUrl = req.body.longUrl
        let body = req.body
        let query = req.query

        let check = await GET_ASYNC(`${longUrl}`)
        if (check) {
            let responce = JSON.parse(check)
            console.log("data is from cache")
            return res.status(200).send(responce)
        }



       

        if (!isValidBody(body)) {
            return res.status(400).send({ status: false, msg: "Body Should not be empty" })
        }
        if (isValidBody(query)) {
            return res.status(400).send({ status: false, msg: "Invalid parameters" })
        }

        if (!isValid(longUrl)) {
            return res.status(400).send({ status: false, msg: "longUrl should not be empty" })
        }

        if (!validUrl.isUri(baseUrl)) {
            return res.status(400).send({ status: false, msg: "baseUrl is not valid" })
        }



        if (!validUrl.isUri(longUrl)) {
            return res.status(400).send({ status: false, msg: "longUrl is not valid" })
        }

        const urlCode = shortid.generate().toLowerCase()
        let shortUrl = baseUrl + '/' + urlCode

        const data = {
            longUrl,
            shortUrl,
            urlCode
        }

        let longUrlExist = await urlModel.findOne({ longUrl: longUrl }).select({ longUrl: 1, shortUrl: 1, urlCode: 1, _id: 0 })
        if (longUrlExist) {
            await SET_ASYNC(`${longUrl}`, JSON.stringify(longUrlExist))
            console.log("data is from db")
            return res.status(200).send({ status: true, msg: longUrlExist })
        } else {
            let savedData = await urlModel.create(data)

            let response = await urlModel.findOne({ _id: savedData._id }).select({ longUrl: 1, shortUrl: 1, urlCode: 1, _id: 0 })
            return res.status(201).send({ status: true, msg: response })

        }
    } catch (err) {
        console.log("This is the error :", err.message)
        return res.status(500).send({ msg: "Error", error: err.message })
    }
}

module.exports.createUrl = createUrl


//***********************************************GET/url *********************************************************//

const getUrl = async function (req, res) {
    try {
        let urlCode = req.params.urlCode
        if (!urlCode) return res.status(404).send({ status: false, msg: "urlCode should be present" })

        if (isValidBody(req.body)) return res.status(400).send({ status: false, msg: "body must not be present" })
        if (isValidBody(req.query)) return res.status(400).send({ status: false, msg: "invalid parameters" })

        let check = await GET_ASYNC(`${urlCode}`)
        if (check) {
            let responce = JSON.parse(check)
            console.log("data is from cache")
            return res.status(302).redirect(responce.longUrl)
        }

        let url = await urlModel.findOne({ urlCode: urlCode }).select({ longUrl: 1, _id: 0 })
        if (url) {
            await SET_ASYNC(`${urlCode}`, JSON.stringify(url))
            console.log('data is from mongodb')
            return res.status(302).redirect(url.longUrl)

        } else {
            return res.status(404).send({ status: false, msg: "urlcode does not exist" })
        }

    } catch (err) {
        console.log("This is error :", err.message)
        return res.status(500).send({ msg: "Error", error: err.message })
    }
}


module.exports.getUrl = getUrl


////////////////////////////////////////End of urlController //////////////////////////////////////////