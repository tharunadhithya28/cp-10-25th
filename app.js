const express = require("express");
const path = require("path");

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const app = express();
app.use(express.json());
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

initializeDBAndServer();

//authorize
const authorizeToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
    jwt.verify(jwtToken, "fdfgfdgfgf", (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

//Login
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const checkUsername = `SELECT * 
    FROM user
    WHERE username = '${username}'`;
  const dbResponse = await db.get(checkUsername);
  if (dbResponse === undefined) {
    response.status(400);
    response.send("Invalid User");
  } else {
    const realPassword = await bcrypt.compare(password, dbResponse.password);
    if (realPassword === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "fdfgfdgfgf");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid Password");
    }
  }
});

const convertToCamelCase = (eachItem) => {
  return {
    stateId: eachItem.state_id,
    stateName: eachItem.state_name,
    population: eachItem.population,
  };
};

// get all states
app.get("/states/", authorizeToken, async (request, response) => {
  const getAllStates = `
    SELECT * 
    FROM state;`;
  const dbResponse = await db.all(getAllStates);
  response.send(dbResponse.map((eachItem) => convertToCamelCase(eachItem)));
});

//get based on stateid
app.get("/states/:stateId/", authorizeToken, async (request, response) => {
  const { stateId } = request.params;
  const getStates = `
    SELECT * 
    FROM state
    WHERE 
    state_id = ${stateId};`;
  const dbResponse = await db.get(getStates);
  response.send(convertToCamelCase(dbResponse));
});

// create district
app.post("/districts/", authorizeToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const createDistrict = `
    INSERT INTO 
    district (district_name,state_id,cases,cured,active,deaths)
    VALUES (
        '${districtName}',
        ${stateId},
        ${cases},
        ${cured},
        ${active},
        ${deaths});`;
  const dbResponse = await db.run(createDistrict);
  response.send("District Created Successfully");
});

const convertToCamelCaseDistrict = (eachItem) => {
  return {
    districtId: eachItem.district_id,
    districtName: eachItem.district_name,
    stateId: eachItem.state_id,
    cases: eachItem.cases,
    cured: eachItem.cured,
    active: eachItem.active,
    deaths: eachItem.deaths,
  };
};
//based on districtId
app.get("/districts/:districtId", authorizeToken, async (request, response) => {
  const { districtId } = request.params;
  const getDistrict = `
    SELECT * 
    FROM district 
    WHERE district_id = ${districtId};`;
  const dbResponse = await db.get(getDistrict);
  response.send(convertToCamelCaseDistrict(dbResponse));
});

//delete district
app.delete(
  "/districts/:districtId/",
  authorizeToken,
  async (request, response) => {
    const { districtId } = request.params;
    const delDistrict = `
    DELETE FROM district
    WHERE district_id = ${districtId};`;
    const dbResponse = await db.run(delDistrict);
    response.send("District Removed");
  }
);

//update district
app.put(
  "/districts/:districtId/",
  authorizeToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const updateDistrict = `
    UPDATE district
    SET 
    district_name = '${districtName}',
    state_id = ${stateId},
    cases = ${cases},
    cured = ${cured},
    active = ${active},
    deaths = ${deaths} 
    WHERE district_id = ${districtId};`;
    const dbResponse = await db.run(updateDistrict);
    response.send("District Details Updated");
  }
);

//total
app.get(
  "/states/:stateId/stats/",
  authorizeToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getTotal = `
    SELECT SUM(cases) AS totalCases,SUM(cured) AS totalCured,
    SUM(active) as totalActive, SUM(deaths) as totalDeaths 
    FROM district
    WHERE state_id = ${stateId};`;
    const dbResponse = await db.get(getTotal);
    response.send(dbResponse);
  }
);

module.exports = app;
