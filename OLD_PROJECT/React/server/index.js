const express = require("express");
const http = require("http");
const bodyParser = require("body-parser");
const mysql = require("mysql2");
const cors = require("cors");

const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "root1234",
  database: "TheNetValues",
});

const PORT = process.env.PORT || 3001;

const app = express();
app.use(cors());

app.get("/:tableName/:year", (req, res) => {
  const year = req.params.year;
  const tableName = req.params.tableName;
  const tableQuery = `SELECT * FROM ${tableName}${year} WHERE NOT Team='TOT'`;
  db.query(tableQuery, (err, result) => {
    if (err) console.log(err);
    else res.send(result);
  });
});



// ========================================================================
//        SORT COLUMNS
// ========================================================================

app.get("/sort/:tableName/:columnName/:order/:year", (req,res) => {
  const year = req.params.year;
  const tableName = req.params.tableName;
  const columnName = req.params.columnName;
  const order = req.params.order;
  const tableQuery = `SELECT * FROM ${tableName}${year} WHERE NOT Team='TOT' ORDER BY ${columnName} ${order}, Pk`;
  db.query(tableQuery,
    (err, result) => {
      if (err) console.log(err);
      else res.send(result);
    }
  );
})


app.get("/api", (req, res) => {
  res.json({ message: "Hello from Express!" });
});

app.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});
